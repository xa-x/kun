"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

/**
 * Fades a block up once as it enters the viewport. It exists to give a long
 * page a reading rhythm (content arrives in the order you read it).
 *
 * The initial style is identical on server and client so hydration matches;
 * reduced motion only collapses the transition to an instant snap.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }
        }
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
