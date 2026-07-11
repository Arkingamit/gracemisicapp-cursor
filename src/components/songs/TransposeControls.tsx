import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus } from 'lucide-react';

interface TransposeControlsProps {
  transposition: number;
  currentKey: string;
  onTransposeUp: () => void;
  onTransposeDown: () => void;
  onReset: () => void;
  useNumberSystem?: boolean;
  onNumberSystemChange?: (value: boolean) => void;
  lightTheme?: boolean;
}

const TransposeControls: React.FC<TransposeControlsProps> = ({
  transposition,
  currentKey,
  onTransposeUp,
  onTransposeDown,
  onReset,
  useNumberSystem = false,
  onNumberSystemChange,
  lightTheme = false,
}) => {
  const [showKey, setShowKey] = React.useState(false);
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setShowKey(true);
    const timer = setTimeout(() => setShowKey(false), 1500);
    return () => clearTimeout(timer);
  }, [transposition, currentKey]);

  const getTranspositionText = (value: number) => {
    if (value === 0) return 'Original';
    return value > 0 ? `+${value}` : `${value}`;
  };

  const themeBtnClass = lightTheme 
    ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100" 
    : "";

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className={`h-8 w-8 shrink-0 ${themeBtnClass}`}
        onClick={onTransposeDown}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        className={`h-8 min-w-[60px] px-3 text-xs font-semibold transition-all ${themeBtnClass}`}
        onClick={onReset}
        disabled={transposition === 0}
      >
        {showKey ? currentKey : 'Reset'}
      </Button>

      <Button
        variant="outline"
        size="icon"
        className={`h-8 w-8 shrink-0 ${themeBtnClass}`}
        onClick={onTransposeUp}
      >
        <Plus className="h-4 w-4" />
      </Button>

      {transposition !== 0 && (
        <span className="text-xs text-muted-foreground ml-1">
          ({getTranspositionText(transposition)})
        </span>
      )}

      {onNumberSystemChange && (
        <div className="flex items-center gap-2 ml-4 border-l pl-4 dark:border-border">
          <Switch 
            id="number-system-toggle" 
            checked={useNumberSystem}
            onCheckedChange={onNumberSystemChange}
            className={lightTheme ? "data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-zinc-900 [&>span]:bg-white" : ""}
          />
          <Label htmlFor="number-system-toggle" className="text-xs whitespace-nowrap cursor-pointer">
            Numbers
          </Label>
        </div>
      )}
    </div>
  );
};

export default TransposeControls;
