# 21st.dev components

The project's existing vanilla HTML/Three.js stack is retained. The following MIT-licensed Motion Primitives components by Julien Thibeaut (ibelick), discovered through the 21st.dev catalogue, are adapted to vanilla JavaScript in dist/redesign.js:

- **Tilt**: normalized cursor offsets, perspective(1000px), spring-interpolated rotateX/rotateY. Used in the earlier concept; replaced by the current hover-preview gallery.
- **Magnetic**: center-distance falloff, intensity and range, spring return. Used on two primary contact links.
- **Animated Background**: active-item shared highlight measured from selected button. Used on portfolio discipline filters; native button semantics retained.

Original sources: https://github.com/ibelick/motion-primitives/tree/main/components/core
Catalogue: https://21st.dev/community/components/explore/mouse-effects and https://21st.dev/community/components/explore/react-tabs
License: dist/vendor/MOTION-PRIMITIVES-LICENSE.txt

Adaptations add reduced-motion and pause handling, fine-pointer gating, conservative movement limits and native keyboard semantics. No React runtime is required.

The independent Von hier. Weiter. clone adds native accessible discipline tabs, desktop gallery dragging, restrained WAAPI entrances and an original Three.js image-refraction shader (now archived after the origin section was removed). These additions are custom implementation, not claimed as further 21st.dev components.

Current project-gallery.js consolidates filters, infinite scrolling, drag and preview cycling. The archived line-signal.js is no longer loaded. The final per-filament hero entrance is custom shader code in landscapes.js and intro-threads.js.
