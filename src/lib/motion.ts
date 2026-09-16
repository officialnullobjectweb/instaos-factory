import type { Transition, Variants } from "framer-motion";

/** House easing — quiet deceleration, never bouncy. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const durations = {
  fast: 0.15,
  base: 0.2,
  slow: 0.25,
} as const;

export const baseTransition: Transition = {
  duration: durations.base,
  ease: EASE,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { duration: durations.fast, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: baseTransition },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: durations.fast, ease: EASE },
  },
};

/** Parent for staggered list reveals. */
export const listContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};
