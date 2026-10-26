"""Private, read-only Docker inventory backup. Run before catalog writes."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def docker(*args):
    result = subprocess.run(['docker', 'compose', *args], cwd=ROOT, capture_output=True)
    if result.returncode:
        raise RuntimeError('Docker backup command failed; no catalog writes permitted.')
    return result.stdout


def backup():
    destination = ROOT / '.local/catalog/backups' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination.mkdir(parents=True)
    # Keep password expansion inside the container; credentials never enter output or arguments.
    for service, database in [('vehicle-db', 'vehicle_db'), ('order-db', 'order_db'),
                              ('payment-db', 'payment_db'), ('users-db', 'users_db')]:
        dump = docker('exec', '-T', service, 'sh', '-c',
                      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction '
                      '--no-tablespaces --set-gtid-purged=OFF --hex-blob ' + database)
        if b'CREATE TABLE' not in dump or b'Dump completed' not in dump:
            raise RuntimeError('Incomplete database backup: ' + database)
        (destination / (database + '.sql')).write_bytes(dump)
    media = docker('exec', '-T', 'vehicle-service', 'tar', '-czf', '-', '-C', '/var/lib/trivio/media', '.')
    (destination / 'vehicle-media.tar.gz').write_bytes(media)
    # Verify that the media archive can actually be read, including an empty media volume.
    import tarfile
    with tarfile.open(destination / 'vehicle-media.tar.gz') as archive:
        archive.getmembers()
    manifest = {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                for p in destination.iterdir()}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Verified private backup: ' + str(destination))
    return destination


if __name__ == '__main__':
    backup()
