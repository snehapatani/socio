export default function Logo({ size = 40 }) {
  return (
    <svg viewBox="0 0 100 96" width={size} height={size * 0.96} xmlns="http://www.w3.org/2000/svg">
      <g fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="32" y="14" width="36" height="36" rx="7" stroke="#4C1D95" transform="rotate(45 50 32)"/>
        <rect x="14" y="46" width="36" height="36" rx="7" stroke="#7C3AED" transform="rotate(45 32 64)"/>
        <rect x="50" y="46" width="36" height="36" rx="7" stroke="#A78BFA" transform="rotate(45 68 64)"/>
      </g>
    </svg>
  );
}
