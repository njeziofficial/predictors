import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { groupNairaInput } from "@/lib/wallet";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** An amount box that shows thousands commas as you type. parseNaira reads what it gives back. */
const NairaInput = ({ value, onValueChange, ...props }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  // How many characters (commas aside) were left of the caret, to put it back after regrouping.
  const caret = useRef<number | null>(null);
  const shown = groupNairaInput(value);

  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return;
    let position = 0;
    for (let left = caret.current; position < shown.length && left > 0; position++) {
      if (shown[position] !== ",") left--;
    }
    input.current.setSelectionRange(position, position);
    caret.current = null;
  });

  return (
    <Input
      {...props}
      ref={input}
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onChange={(e) => {
        const beforeCaret = e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length);
        caret.current = beforeCaret.replace(/[^\d.-]/g, "").length;
        onValueChange(groupNairaInput(e.target.value));
      }}
    />
  );
};

export default NairaInput;
