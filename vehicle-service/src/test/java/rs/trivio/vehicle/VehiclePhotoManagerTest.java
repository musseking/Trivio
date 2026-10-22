package rs.trivio.vehicle;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.awt.image.BufferedImage;
import java.io.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Database collaborators are mocked. Only generated images under @TempDir are written. */
class VehiclePhotoManagerTest {
    @TempDir Path directory;
    private VehicleRepository vehicles;
    private VehiclePhotoRepository photos;
    private VehiclePhotoStorage storage;
    private VehiclePhotoManager manager;
    private Vehicle vehicle;
    private final List<VehiclePhoto> metadata = new ArrayList<>();
    private long nextId;

    @BeforeEach void setUp() {
        vehicles = mock(VehicleRepository.class);
        photos = mock(VehiclePhotoRepository.class);
        storage = spy(new VehiclePhotoStorage(directory.toString()));
        manager = new VehiclePhotoManager(vehicles, photos, storage);
        vehicle = new Vehicle("Brand", "Model", 2024, new BigDecimal("20000"), 12000, "PETROL");
        ReflectionTestUtils.setField(vehicle, "id", 1L);
        nextId = 1;
        when(vehicles.findForUpdate(1L)).thenReturn(Optional.of(vehicle));
        when(vehicles.findById(1L)).thenReturn(Optional.of(vehicle));
        when(photos.findByVehicleIdOrderByPositionAscIdAsc(1L)).thenAnswer(invocation -> metadata.stream()
            .sorted(Comparator.comparingInt(VehiclePhoto::getPosition).thenComparing(VehiclePhoto::getId)).toList());
        when(photos.save(any(VehiclePhoto.class))).thenAnswer(invocation -> {
            VehiclePhoto photo = invocation.getArgument(0);
            ReflectionTestUtils.setField(photo, "id", nextId++);
            metadata.add(photo);
            return photo;
        });
        doAnswer(invocation -> { metadata.remove(invocation.getArgument(0)); return null; }).when(photos).delete(any());
        when(photos.existsByFilenameOrThumbnailFilename(anyString(), anyString())).thenAnswer(invocation -> {
            String filename = invocation.getArgument(0);
            return metadata.stream().anyMatch(photo -> photo.getFilename().equals(filename) || photo.getThumbnailFilename().equals(filename));
        });
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) finish(false);
    }

    @Test void uploadAppendsOrderedPhotosWithOneCoverAndKeepsFilesAfterCommit() throws Exception {
        var result = manager.upload(1L, List.of(image(), image()));
        assertEquals(2, result.size());
        assertEquals(List.of(0, 1), result.stream().map(VehiclePhotoResponse::position).toList());
        assertTrue(result.getFirst().cover());
        assertFalse(result.getLast().cover());
        assertEquals(4, fileCount());
        finish(true);
        assertEquals(4, fileCount());
        verify(vehicles).findForUpdate(1L);
        verify(photos).flush();
    }

    @Test void earlierSuccessfulBatchFilesAreRemovedWhenLaterUploadFailsAndTransactionRollsBack() throws Exception {
        var invalid = new MockMultipartFile("files", "fake.jpg", "image/jpeg", "not an image".getBytes());
        assertThrows(ResponseStatusException.class, () -> manager.upload(1L, List.of(image(), invalid)));
        assertEquals(2, fileCount());
        finish(false);
        assertEquals(0, fileCount());
    }

    @Test void stagedFilesAreRemovedWhenMetadataPersistenceFails() throws Exception {
        when(photos.save(any(VehiclePhoto.class))).thenThrow(new IllegalStateException("simulated metadata failure"));
        assertThrows(IllegalStateException.class, () -> manager.upload(1L, List.of(image())));
        assertEquals(2, fileCount());
        finish(false);
        assertEquals(0, fileCount());
    }

    @Test void replacementPreservesIdPositionAndCoverAndDeletesOldFilesOnlyAfterCommit() throws Exception {
        VehiclePhoto old = seed(0, true);
        String oldMain = old.getFilename();
        String oldThumb = old.getThumbnailFilename();
        var result = manager.replace(1L, old.getId(), image());
        assertEquals(old.getId(), result.getFirst().id());
        assertEquals(0, result.getFirst().position());
        assertTrue(result.getFirst().cover());
        assertEquals(4, fileCount());
        assertTrue(Files.exists(directory.resolve(oldMain)));
        finish(true);
        assertEquals(2, fileCount());
        assertFalse(Files.exists(directory.resolve(oldMain)));
        assertFalse(Files.exists(directory.resolve(oldThumb)));
        assertTrue(Files.exists(directory.resolve(old.getFilename())));
    }

    @Test void replacementFailurePreservesPreviouslyCommittedFilesAndRemovesNewFiles() throws Exception {
        VehiclePhoto old = seed(0, true);
        String oldMain = old.getFilename();
        String oldThumb = old.getThumbnailFilename();
        doThrow(new IllegalStateException("simulated flush failure")).when(photos).flush();
        assertThrows(IllegalStateException.class, () -> manager.replace(1L, old.getId(), image()));
        assertEquals(4, fileCount());
        finish(false);
        assertEquals(2, fileCount());
        assertTrue(Files.exists(directory.resolve(oldMain)));
        assertTrue(Files.exists(directory.resolve(oldThumb)));
    }

    @Test void deletingCoverChoosesFirstRemainingPhotoAndDefersFileDeletionUntilCommit() throws Exception {
        VehiclePhoto first = seed(0, true);
        VehiclePhoto second = seed(1, false);
        String deletedMain = first.getFilename();
        var result = manager.delete(1L, first.getId());
        assertEquals(1, result.size());
        assertEquals(second.getId(), result.getFirst().id());
        assertEquals(0, result.getFirst().position());
        assertTrue(result.getFirst().cover());
        assertEquals(4, fileCount());
        finish(true);
        assertEquals(2, fileCount());
        assertFalse(Files.exists(directory.resolve(deletedMain)));
    }

    @Test void failedDeleteDoesNotRemovePreviouslyCommittedFiles() throws Exception {
        VehiclePhoto first = seed(0, true);
        manager.delete(1L, first.getId());
        finish(false);
        assertEquals(2, fileCount());
        assertTrue(Files.exists(directory.resolve(first.getFilename())));
    }

    @Test void reorderRequiresExactPermutationAndCoverFromThisVehicle() throws Exception {
        VehiclePhoto first = seed(0, true);
        VehiclePhoto second = seed(1, false);
        for (var request : List.of(
            new VehiclePhotoOrderRequest(List.of(first.getId()), first.getId()),
            new VehiclePhotoOrderRequest(List.of(first.getId(), first.getId()), first.getId()),
            new VehiclePhotoOrderRequest(List.of(first.getId(), 999L), first.getId()),
            new VehiclePhotoOrderRequest(List.of(first.getId(), second.getId()), 999L)
        )) {
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> manager.reorder(1L, request)).getStatusCode().value());
        }
        assertEquals(0, first.getPosition());
        assertTrue(first.isCover());
        verify(photos, never()).flush();
    }

    @Test void exactPermutationUpdatesAllPositionsAndTheSingleCover() throws Exception {
        VehiclePhoto first = seed(0, true);
        VehiclePhoto second = seed(1, false);
        var result = manager.reorder(1L, new VehiclePhotoOrderRequest(List.of(second.getId(), first.getId()), second.getId()));
        assertEquals(List.of(second.getId(), first.getId()), result.stream().map(VehiclePhotoResponse::id).toList());
        assertEquals(List.of(0, 1), result.stream().map(VehiclePhotoResponse::position).toList());
        assertTrue(result.getFirst().cover());
        assertFalse(result.getLast().cover());
        assertEquals(4, fileCount());
    }

    @Test void rejectsOverflowAndForeignPhotoBeforeWritingAnyFile() throws Exception {
        for (int index = 0; index < 10; index++) {
            VehiclePhoto photo = new VehiclePhoto(vehicle, UUID.randomUUID() + ".jpg", UUID.randomUUID() + "-thumb.jpg", index, index == 0);
            photos.save(photo);
        }
        clearInvocations(storage);
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> manager.upload(1L, List.of(image()))).getStatusCode().value());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> manager.delete(1L, 999L)).getStatusCode().value());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> manager.replace(1L, 999L, image())).getStatusCode().value());
        verifyNoInteractions(storage);
    }

    @Test void publicMediaRequiresARegisteredFilenameAndCannotServeOrphanFiles() throws Exception {
        var orphan = storage.store(image());
        assertTrue(Files.exists(directory.resolve(orphan.filename())));
        clearInvocations(storage);
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> manager.media(orphan.filename())).getStatusCode().value());
        verify(storage, never()).read(anyString());
        VehiclePhoto registered = seed(0, true);
        assertEquals((byte) 0xff, manager.media(registered.getFilename())[0]);
        assertEquals((byte) 0xff, manager.media(registered.getThumbnailFilename())[0]);
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> manager.media("../private.jpg")).getStatusCode().value());
    }

    @Test void missingVehicleDoesNotWriteFiles() throws Exception {
        when(vehicles.findForUpdate(999L)).thenReturn(Optional.empty());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> manager.upload(999L, List.of(image()))).getStatusCode().value());
        verifyNoInteractions(storage);
    }

    private VehiclePhoto seed(int position, boolean cover) throws Exception {
        var stored = storage.store(image());
        return photos.save(new VehiclePhoto(vehicle, stored.filename(), stored.thumbnailFilename(), position, cover));
    }

    private static MultipartFile image() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(12, 8, BufferedImage.TYPE_INT_RGB), "png", bytes);
        return new MockMultipartFile("files", "photo.png", "image/png", bytes.toByteArray());
    }

    private long fileCount() throws IOException {
        try (var paths = Files.list(directory)) { return paths.count(); }
    }

    private void finish(boolean committed) {
        var synchronizations = TransactionSynchronizationManager.getSynchronizations();
        try {
            if (committed) synchronizations.forEach(TransactionSynchronization::afterCommit);
            synchronizations.forEach(synchronization -> synchronization.afterCompletion(
                committed ? TransactionSynchronization.STATUS_COMMITTED : TransactionSynchronization.STATUS_ROLLED_BACK));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }
}
