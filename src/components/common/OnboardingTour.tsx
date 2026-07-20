"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { TOUR_STEPS, GROUP_TOUR_STEPS, ADD_SONG_TOUR_STEPS, TourStep, TOUR_STORAGE_KEY, TOUR_START_KEY, TOUR_START_FROM_SELECTOR_KEY, GROUP_TOUR_STORAGE_KEY, GROUP_TOUR_START_KEY, GROUP_TOUR_READY_EVENT, GROUP_TOUR_EXPAND_EVENT, GROUP_TOUR_EXPAND_MUSICIANS_EVENT, ADD_SONG_TOUR_STORAGE_KEY, ADD_SONG_TOUR_START_KEY } from "@/lib/tourSteps";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [tooltipPlacement, setTooltipPlacement] = useState<"top" | "bottom">("bottom");
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [tourType, setTourType] = useState<"global" | "group" | "add-song">("global");

  // Use all steps for cross-page navigation
  const relevantSteps = tourType === "group" ? GROUP_TOUR_STEPS : tourType === "add-song" ? ADD_SONG_TOUR_STEPS : TOUR_STEPS;
  const currentStep: TourStep | undefined = relevantSteps[currentIndex];

  // Check if tour should start
  useEffect(() => {
    const globalCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    const globalStart = localStorage.getItem(TOUR_START_KEY);

    const addSongCompleted = localStorage.getItem(ADD_SONG_TOUR_STORAGE_KEY);
    const addSongStart = localStorage.getItem(ADD_SONG_TOUR_START_KEY);

    if (globalStart === "true" && globalCompleted !== "true") {
      const fromSelector = localStorage.getItem(TOUR_START_FROM_SELECTOR_KEY);
      let startIndex = 0;
      if (fromSelector) {
        const idx = TOUR_STEPS.findIndex((s) => s.selector === fromSelector);
        if (idx >= 0) startIndex = idx;
      }
      const startStep = TOUR_STEPS[startIndex];
      const pageOk =
        startStep.page === "*" ||
        startStep.page === pathname ||
        (startStep.page !== "*" && pathname.startsWith(startStep.page));

      if (pageOk) {
        const timer = setTimeout(() => {
          setTourType("global");
          setActive(true);
          setCurrentIndex(startIndex);
          localStorage.removeItem(TOUR_START_KEY);
          localStorage.removeItem(TOUR_START_FROM_SELECTOR_KEY);
        }, 800);
        return () => clearTimeout(timer);
      }
    } else if (addSongStart === "true" && addSongCompleted !== "true" && (ADD_SONG_TOUR_STEPS[0].page === '*' || ADD_SONG_TOUR_STEPS[0].page === pathname)) {
      const timer = setTimeout(() => {
        setTourType("add-song");
        setActive(true);
        setCurrentIndex(0);
        localStorage.removeItem(ADD_SONG_TOUR_START_KEY);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Group (song set) tour: only after create + ≥1 song (PDF/transpose targets exist)
  useEffect(() => {
    const tryStartGroupTour = () => {
      if (active) return;
      const groupCompleted = localStorage.getItem(GROUP_TOUR_STORAGE_KEY);
      const groupStart = localStorage.getItem(GROUP_TOUR_START_KEY);
      if (groupStart !== "true" || groupCompleted === "true") return;
      if (!pathname.startsWith("/groups/view")) return;

      // PDF export only renders when the set has songs
      const hasSongFeatures = document.querySelector('[data-tour="set-export-pdf"]');
      if (!hasSongFeatures) return;

      // Expand first song so transpose / layout / settings targets are in the DOM
      window.dispatchEvent(new Event(GROUP_TOUR_EXPAND_EVENT));

      setTimeout(() => {
        setTourType("group");
        setActive(true);
        setCurrentIndex(0);
        localStorage.removeItem(GROUP_TOUR_START_KEY);
      }, 500);
    };

    tryStartGroupTour();
    window.addEventListener(GROUP_TOUR_READY_EVENT, tryStartGroupTour);
    return () => window.removeEventListener(GROUP_TOUR_READY_EVENT, tryStartGroupTour);
  }, [pathname, active]);

  // Position the spotlight and tooltip when step changes
  const positionTooltip = useCallback(() => {
    if (!active || !currentStep) return;

    const findVisible = () => {
      const elements = document.querySelectorAll(currentStep.selector);
      for (const element of Array.from(elements)) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return element;
      }
      return null;
    };

    const placeAround = (el: Element) => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const padding = 8;

        const newRect: TargetRect = {
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        };
        setTargetRect(newRect);

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const tooltipWidth = Math.min(340, viewportWidth - 32);
        const tooltipHeight = 200;

        let top: number;
        let left: number;
        let placement: "top" | "bottom" = "bottom";

        const spaceBelow = viewportHeight - (rect.bottom + padding);
        const spaceAbove = rect.top - padding;

        if (
          currentStep.placement === "top" ||
          (currentStep.placement === "auto" && spaceBelow < tooltipHeight && spaceAbove > tooltipHeight)
        ) {
          placement = "top";
          top = rect.top - padding - tooltipHeight - 16;
        } else {
          placement = "bottom";
          top = rect.bottom + padding + 16;
        }

        top = Math.max(16, Math.min(top, viewportHeight - tooltipHeight - 16));
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16));

        setTooltipPlacement(placement);
        setTooltipStyle({
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          width: `${tooltipWidth}px`,
          zIndex: 10002,
        });
      }, 350);
    };

    const showCenteredFallback = () => {
      setTargetRect(null);
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const tooltipWidth = Math.min(340, viewportWidth - 32);
      setTooltipPlacement("bottom");
      setTooltipStyle({
        position: "fixed",
        top: `${viewportHeight / 2 - 100}px`,
        left: `${viewportWidth / 2 - tooltipWidth / 2}px`,
        width: `${tooltipWidth}px`,
        zIndex: 10002,
      });
    };

    // Expand musicians panel first, then measure so assign UI is in the spotlight
    if (currentStep.selector === '[data-tour="set-musicians"]') {
      window.dispatchEvent(new Event(GROUP_TOUR_EXPAND_MUSICIANS_EVENT));
      setTimeout(() => {
        const el = findVisible();
        if (el) placeAround(el);
        else showCenteredFallback();
      }, 250);
      return;
    }

    const el = findVisible();
    if (!el) {
      showCenteredFallback();
      return;
    }

    placeAround(el);
  }, [active, currentStep]);

  useEffect(() => {
    positionTooltip();

    // Reposition on resize
    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [positionTooltip, currentIndex]);

  // Retry finding element if not found (for elements that render late);
  // if still missing, skip to the next step that has a visible target
  useEffect(() => {
    if (!active || !currentStep) return;

    if (currentStep.selector === '[data-tour="set-musicians"]') {
      window.dispatchEvent(new Event(GROUP_TOUR_EXPAND_MUSICIANS_EVENT));
    }

    const isVisible = (selector: string) => {
      const nodes = document.querySelectorAll(selector);
      return Array.from(nodes).some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    };

    if (!isVisible(currentStep.selector)) {
      retryTimerRef.current = setTimeout(() => {
        if (currentStep.selector === '[data-tour="set-musicians"]') {
          window.dispatchEvent(new Event(GROUP_TOUR_EXPAND_MUSICIANS_EVENT));
        }

        if (isVisible(currentStep.selector)) {
          positionTooltip();
          return;
        }

        // Skip ahead to the next step with a visible target
        for (let i = currentIndex + 1; i < relevantSteps.length; i++) {
          const step = relevantSteps[i];
          if (step.selector === '[data-tour="set-musicians"]') {
            window.dispatchEvent(new Event(GROUP_TOUR_EXPAND_MUSICIANS_EVENT));
          }
          if (isVisible(step.selector)) {
            setCurrentIndex(i);
            return;
          }
        }
        // Nothing left to show
        positionTooltip();
      }, 600);
    }

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [active, currentStep, currentIndex, relevantSteps, positionTooltip]);

  const handleNext = () => {
    if (currentIndex < relevantSteps.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextStep = relevantSteps[nextIndex];
      
      // Navigate if the next step is on a different specific page
      if (nextStep.page !== '*' && nextStep.page !== pathname) {
        router.push(nextStep.page);
      }
      
      setCurrentIndex(nextIndex);
    } else {
      completeTour();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevStep = relevantSteps[prevIndex];
      
      // Navigate if the previous step is on a different specific page
      if (prevStep.page !== '*' && prevStep.page !== pathname) {
        router.push(prevStep.page);
      }
      
      setCurrentIndex(prevIndex);
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    setActive(false);
    
    if (tourType === "group") {
      localStorage.setItem(GROUP_TOUR_STORAGE_KEY, 'true');
    } else if (tourType === "add-song") {
      localStorage.setItem(ADD_SONG_TOUR_STORAGE_KEY, 'true');
    } else {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    }
    
    // Cleanup body styling
    setTargetRect(null);
  };

  if (!active || !currentStep) return null;

  // Render via portal to ensure it's on top of everything
  return createPortal(
    <div className="onboarding-tour-overlay" style={{ position: "fixed", inset: 0, zIndex: 10000 }}>
      {/* Dark overlay with spotlight cutout */}
      <svg
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 10000 }}
        onClick={handleSkip}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring */}
      {targetRect && (
        <div
          style={{
            position: "fixed",
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            borderRadius: "12px",
            border: "2px solid rgba(139, 92, 246, 0.6)",
            boxShadow: "0 0 0 4px rgba(139, 92, 246, 0.15), 0 0 30px rgba(139, 92, 246, 0.2)",
            zIndex: 10001,
            pointerEvents: "none",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        style={tooltipStyle}
        className={`onboarding-tooltip ${tooltipPlacement === "top" ? "arrow-bottom" : "arrow-top"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(24, 24, 32, 0.98) 0%, rgba(30, 20, 40, 0.98) 100%)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139, 92, 246, 0.1)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "white",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {currentStep.title}
            </h3>
            <button
              onClick={handleSkip}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: "8px",
                padding: "4px",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginLeft: "12px",
              }}
              title="Skip tour"
            >
              <X size={14} />
            </button>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.7)",
              margin: "0 0 16px 0",
            }}
          >
            {currentStep.description}
          </p>

          {/* Footer: Progress + Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {relevantSteps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIndex ? "18px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    background: i === currentIndex
                      ? "linear-gradient(90deg, #8B5CF6, #A78BFA)"
                      : i < currentIndex
                        ? "rgba(139, 92, 246, 0.4)"
                        : "rgba(255,255,255,0.15)",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {currentIndex > 0 && (
                <button
                  onClick={handleBack}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <ChevronLeft size={14} />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "white",
                  background: "linear-gradient(135deg, #7C3AED, #8B5CF6)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(124, 58, 237, 0.4)",
                  transition: "all 0.2s",
                }}
              >
                {currentIndex === relevantSteps.length - 1 ? (
                  <>
                    <Sparkles size={14} />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step counter */}
          <div
            style={{
              textAlign: "center",
              marginTop: "12px",
              fontSize: "10px",
              color: "rgba(255,255,255,0.3)",
              fontWeight: 600,
              letterSpacing: "0.5px",
            }}
          >
            STEP {currentIndex + 1} OF {relevantSteps.length}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
