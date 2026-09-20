import { useState } from "react";
import { X, ArrowRight, FolderOpen, Network, FileCheck2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface HowItWorksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDemoCase: () => void;
}

const STEPS = [
  {
    step: 1,
    title: "1. Choose an Investigation Case",
    subtitle: "Start with real-world case facts",
    description:
      "DRISTI-NET organizes complex investigations into clear case files. Each case includes police complaints, call logs, bank transactions, and location records in one place.",
    icon: FolderOpen,
    accent: "text-electric-blue bg-electric-blue/10",
  },
  {
    step: 2,
    title: "2. Explore the Investigation Map",
    subtitle: "See how people and clues are connected",
    description:
      "Instead of reading hundreds of disconnected spreadsheets, see suspects, mobile handsets, bank accounts, and locations linked automatically by shared evidence.",
    icon: Network,
    accent: "text-amber bg-amber/10",
  },
  {
    step: 3,
    title: "3. Click Any Connection to Verify Evidence",
    subtitle: "Trust only what can be proven",
    description:
      "Every connection links directly to the original document. Click any line to open the police report, bank statement, or cell tower log with the exact highlighted proof.",
    icon: FileCheck2,
    accent: "text-verified-emerald bg-verified-emerald/10",
  },
];

export function HowItWorksModal({
  open,
  onOpenChange,
  onStartDemoCase,
}: HowItWorksModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const stepData = STEPS[currentStep];
  const Icon = stepData.icon;
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onOpenChange(false);
      onStartDemoCase();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border border-border-strong bg-surface-1 shadow-panel">
        <DialogTitle className="sr-only">How DRISTI-NET Works Guided Walkthrough</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-surface-2 px-6 py-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-electric-blue block">
              First-Time Guide
            </span>
            <h2 className="text-base font-bold text-text-primary">
              How DRISTI-NET Works
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-6 space-y-5">
          {/* Progress Indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 flex-1 rounded-pill transition-colors ${
                  idx === currentStep
                    ? "bg-electric-blue"
                    : idx < currentStep
                      ? "bg-verified-emerald"
                      : "bg-surface-3"
                }`}
                aria-label={`Go to step ${s.step}`}
              />
            ))}
          </div>

          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-xl shrink-0 ${stepData.accent}`}>
              <Icon className="h-6 w-6" />
            </div>

            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-semibold text-text-secondary">
                Step {stepData.step} of 3
              </span>
              <h3 className="text-base font-bold text-text-primary">
                {stepData.title}
              </h3>
              <p className="text-xs font-medium text-electric-blue">
                {stepData.subtitle}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed pt-1">
                {stepData.description}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-2 px-6 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Skip Guide
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="text-xs"
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              className="text-xs gap-1.5"
            >
              <span>{isLast ? "Explore Demo Case" : "Next Step"}</span>
              {isLast ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
