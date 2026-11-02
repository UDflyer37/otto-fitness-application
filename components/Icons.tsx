import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const BarbellIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 9.5v5M6.5 7v10M17.5 7v10M21 9.5v5M6.5 12h11" />
  </Svg>
);

export const PlatesIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 3.5v2M12 18.5v2" />
  </Svg>
);

export const PersonIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </Svg>
);

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PauseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 5.5v13M15 5.5v13" strokeWidth={2.6} />
  </Svg>
);

export const ResetIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 10a7.5 7.5 0 1 1 1.2 6.3" />
    <path d="M4 4.8V10h5.2" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12.6 9.6 17 19 7.4" strokeWidth={2.4} />
  </Svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14.5 5.5 8 12l6.5 6.5" strokeWidth={2.2} />
  </Svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" strokeWidth={2} />
  </Svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" strokeWidth={1.8} />
  </Svg>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19.5 12h-14M11 6.5 5.5 12 11 17.5" strokeWidth={1.8} />
  </Svg>
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 17 17 7M8.5 7H17v8.5" strokeWidth={1.8} />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 6v12M6 12h12" strokeWidth={2.2} />
  </Svg>
);

export const MinusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 12h12" strokeWidth={2.2} />
  </Svg>
);

export const ShuffleIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.5 6.5h3.2c1.4 0 2.2.7 3 2l4.6 7c.8 1.3 1.6 2 3 2h3.2" />
    <path d="M3.5 17.5h3.2c1.4 0 2.2-.7 3-2l4.6-7c.8-1.3 1.6-2 3-2h3.2" />
    <path d="M18 3.8l3 2.7-3 2.7M18 14.8l3 2.7-3 2.7" />
  </Svg>
);

export const DownloadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </Svg>
);

export const UploadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 15.5v-11M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4.5 19.5h15" />
  </Svg>
);

export const TrashIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9L17.5 7" />
  </Svg>
);

export const LinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10.2 13.8a3.4 3.4 0 0 0 4.9 0l2.6-2.6a3.5 3.5 0 0 0-4.9-4.9l-1.3 1.3" />
    <path d="M13.8 10.2a3.4 3.4 0 0 0-4.9 0l-2.6 2.6a3.5 3.5 0 0 0 4.9 4.9l1.3-1.3" />
  </Svg>
);

export const GripIcon = (props: IconProps) => (
  <Svg {...props}>
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="7" r="1.4" />
      <circle cx="15" cy="7" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="17" r="1.4" />
      <circle cx="15" cy="17" r="1.4" />
    </g>
  </Svg>
);

export const CopyIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.4" />
    <path d="M15.5 5.5h-9a1.4 1.4 0 0 0-1.4 1.4v9" />
  </Svg>
);

export const TimerIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="13.2" r="7.3" />
    <path d="M12 9.8v3.4l2.3 1.6M9.4 3h5.2" />
  </Svg>
);
