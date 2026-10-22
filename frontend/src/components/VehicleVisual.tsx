/** Honest fallback: never substitute a photo of another vehicle for a missing image. */
export function VehicleVisual({ large = false }: { large?: boolean }) {
  return <div className={`vehicle-visual ${large ? 'vehicle-visual-large' : ''}`}>
    <span className="vehicle-visual-label">TRIVIO / AUTOMOBILI</span>
    <svg className="vehicle-silhouette" viewBox="0 0 520 210" fill="none" aria-hidden="true">
      <ellipse cx="260" cy="176" rx="206" ry="13" fill="currentColor" opacity=".06" />
      <path d="m54 132 20-30 102-13 51-48h102l68 53 64 12 18 28-2 28h-40m-66 0H153m-66 0H54v-30Z"
        fill="currentColor" fillOpacity=".04" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="m190 88 45-36h41v36h-86Zm98 0V52h35l46 36h-81ZM74 105l23 10H65m376 1h22m-63 15h37M178 103h22m101 0h22"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="157" r="33" fill="var(--surface)" stroke="currentColor" strokeWidth="3" />
      <circle cx="120" cy="157" r="19" stroke="currentColor" strokeWidth="2" opacity=".4" />
      <circle cx="404" cy="157" r="33" fill="var(--surface)" stroke="currentColor" strokeWidth="3" />
      <circle cx="404" cy="157" r="19" stroke="currentColor" strokeWidth="2" opacity=".4" />
    </svg>
    <span className="vehicle-visual-note">Fotografija nije dostupna</span>
  </div>;
}
