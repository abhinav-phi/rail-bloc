import React from 'react';

/** Vande Bharat T-18 trainset with RAIL-BLOC livery — hand-built vector in the
 * orange-grey livery sampled from the team's reference renders. Pure SVG:
 * crisp at any size, theme-adaptive, wheels carry the .atlas-wheel class so
 * the hero can spin them in sync with the entry animation. */
export function VbTrain({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 920 220"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Vande Bharat T-18 trainset with RAIL-BLOC livery"
      className={className}
    >
      <defs>
        <linearGradient id="vbBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9CCD8" />
          <stop offset=".45" stopColor="#A7ABBD" />
          <stop offset="1" stopColor="#8F94A8" />
        </linearGradient>
        <linearGradient id="vbGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2C3A4C" />
          <stop offset=".5" stopColor="#17161C" />
          <stop offset="1" stopColor="#0D1017" />
        </linearGradient>
        <filter id="vbGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id="vbClip">
          <path d="M80,170 L80,84 Q80,78 86,78 L690,78 C770,80 830,92 870,116 Q884,124 890,134 Q896,142 896,152 L896,166 Q896,170 890,170 Z" />
        </clipPath>
      </defs>

      <path className="vb-track" d="M60,190 H880" />
      <path className="vb-track vb-track-soft" d="M60,198 H880" />
      <path
        className="vb-sleeper"
        d="M100,184 V204 M170,184 V204 M240,184 V204 M310,184 V204 M380,184 V204 M450,184 V204 M520,184 V204 M590,184 V204 M660,184 V204 M730,184 V204 M800,184 V204 M860,184 V204"
      />
      <g className="vb-speed-lines">
        <path
          className="vb-speed-line"
          d="M6,110 H150 M0,140 H110 M20,64 H120"
          opacity="0.7"
        />
      </g>

      <path
        d="M80,170 L80,84 Q80,78 86,78 L690,78 C770,80 830,92 870,116 Q884,124 890,134 Q896,142 896,152 L896,166 Q896,170 890,170 Z"
        fill="url(#vbBody)"
        stroke="#7E8496"
        strokeWidth="1.5"
      />

      <g clipPath="url(#vbClip)">
        <rect x="80" y="78" width="816" height="5" fill="#8E93A6" />
        <rect x="80" y="122" width="816" height="24" fill="url(#vbGlass)" />
        <g fill="#3E4F63">
          <rect x="98" y="126" width="46" height="17" rx="3" />
          <rect x="174" y="126" width="46" height="17" rx="3" />
          <rect x="250" y="126" width="46" height="17" rx="3" />
          <rect x="326" y="126" width="46" height="17" rx="3" />
          <rect x="402" y="126" width="46" height="17" rx="3" />
          <rect x="478" y="126" width="46" height="17" rx="3" />
          <rect x="554" y="126" width="46" height="17" rx="3" />
          <rect x="630" y="126" width="46" height="17" rx="3" />
        </g>
        <rect
          x="90"
          y="126"
          width="590"
          height="5"
          fill="#4E6078"
          opacity="0.55"
        />
        <rect x="80" y="146" width="816" height="15" fill="#F04C0D" />
        <rect
          x="80"
          y="163"
          width="816"
          height="3"
          fill="#F04C0D"
          opacity="0.55"
        />
        <rect x="80" y="166" width="816" height="6" fill="#262A33" />
        <g stroke="#82889B" strokeWidth="1.2" opacity="0.7">
          <line x1="330" y1="84" x2="330" y2="118" />
          <line x1="502" y1="84" x2="502" y2="118" />
          <line x1="674" y1="84" x2="674" y2="118" />
        </g>
      </g>

      <path
        d="M742,84 C792,88 832,98 862,118 L846,128 C822,110 788,98 740,92 Z"
        fill="#17161C"
      />
      <path
        d="M748,86 C790,90 822,99 848,114 L840,119 C816,104 786,95 746,90 Z"
        fill="#3E4F63"
        opacity="0.6"
      />

      <circle cx="872" cy="148" r="5" fill="#FFD08A" filter="url(#vbGlow)" />
      <rect x="862" y="156" width="20" height="4" rx="2" fill="#C17F3E" />

      <text
        x="290"
        y="103"
        fontSize="24"
        fontWeight="600"
        letterSpacing="6"
        fill="#232E3C"
        fontFamily="var(--font-plex), sans-serif"
      >
        RAIL-BLOC
      </text>
      <text
        x="292"
        y="114"
        fontSize="8"
        letterSpacing="3.5"
        fill="#5A6B7F"
        fontFamily="var(--font-jetbrains), monospace"
      >
        T-18 · VANDE BHARAT / CONTROLLED MOVEMENT
      </text>

      {(
        [
          [185, 176],
          [285, 176],
          [420, 176],
          [520, 176],
          [680, 176],
          [800, 176],
        ] as const
      ).map(([cx, cy]) => (
        <g
          key={cx}
          className="atlas-wheel"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transformBox: 'view-box',
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r="18"
            fill="#10151D"
            stroke="#566274"
            strokeWidth="3"
          />
          <g stroke="#C17F3E" strokeWidth="2.5">
            <line x1={cx} y1={cy - 15} x2={cx} y2={cy + 15} />
            <line x1={cx - 15} y1={cy} x2={cx + 15} y2={cy} />
            <line x1={cx - 10.6} y1={cy - 10.6} x2={cx + 10.6} y2={cy + 10.6} />
            <line x1={cx + 10.6} y1={cy - 10.6} x2={cx - 10.6} y2={cy + 10.6} />
          </g>
          <circle cx={cx} cy={cy} r="4" fill="#394452" />
        </g>
      ))}
    </svg>
  );
}
