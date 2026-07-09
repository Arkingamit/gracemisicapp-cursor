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
}

const TransposeControls: React.FC<TransposeControlsProps> = ({
  transposition,
  currentKey,
  onTransposeUp,
  onTransposeDown,
  onReset,
  useNumberSystem = false,
  onNumberSystemChange
}) => {
  const getTranspositionText = (value: number) => {
    if (value === 0) return 'Original';
    return value > 0 ? `+${value}` : `${value}`;
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onTransposeDown}
        disabled={transposition <= -11}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        className="h-8 px-3 text-xs"
        onClick={onReset}
        disabled={transposition === 0}
      >
        Reset
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onTransposeUp}
        disabled={transposition >= 11}
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
