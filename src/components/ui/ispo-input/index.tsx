import * as React from "react"
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"

// ============================================================================
// Input - Main container with label support
// ============================================================================
interface IspoInputProps {
  children: ReactNode
  className?: string
}

function IspoInput({ children, className = "" }: IspoInputProps) {
  return <div className={`w-full ${className}`}>{children}</div>
}

// ============================================================================
// Input.Label - VCR-styled label
// ============================================================================
interface LabelProps {
  children: ReactNode
  className?: string
}

function Label({ children, className = "" }: LabelProps) {
  return (
    <label
      className={`font-vcr text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1 block ${className}`}
    >
      {children}
    </label>
  )
}

// ============================================================================
// Input.Textarea - Auto-growing textarea base
// ============================================================================
interface TextareaProps extends Omit<
  React.ComponentProps<"textarea">,
  "className"
> {
  maxHeight?: string
  autoGrow?: boolean
  className?: string
}

function Textarea({
  className = "",
  maxHeight = "50vh",
  autoGrow = true,
  style,
  ...props
}: TextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(props.value || props.defaultValue || "")

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value)
    }
  }, [props.value])

  useEffect(() => {
    if (wrapperRef.current && autoGrow) {
      wrapperRef.current.dataset.replicatedValue = String(value)
    }
  }, [value, autoGrow])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    props.onChange?.(e)
  }

  const finalMaxHeight = style?.maxHeight || maxHeight

  const baseStyles = `
    w-full resize-none
    text-sm text-foreground
    placeholder:text-muted-foreground/60
    focus:outline-none focus:ring-0
    disabled:cursor-not-allowed disabled:opacity-50
    ${className}
  `.replace(/\s+/g, " ").trim()

  if (!autoGrow) {
    return (
      <textarea
        ref={textareaRef}
        data-slot="textarea"
        className={baseStyles}
        style={{ ...style, maxHeight: finalMaxHeight }}
        {...props}
        value={value}
        onChange={handleChange}
      />
    )
  }

  return (
    <div
      ref={wrapperRef}
      className="grow-wrap w-full h-full"
      data-replicated-value={value}
      style={{ maxHeight: finalMaxHeight, width: "100%", height: "100%" }}
    >
      <textarea
        ref={textareaRef}
        data-slot="textarea"
        className={`${baseStyles} overflow-hidden`}
        style={{ width: "100%" }}
        {...props}
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}

// ============================================================================
// Input.Inline - Borderless inline editor
// ============================================================================
interface InlineProps extends Omit<
  React.ComponentProps<"textarea">,
  "className"
> {
  maxHeight?: string
  autoGrow?: boolean
  className?: string
}

function Inline({
  className = "",
  maxHeight,
  autoGrow = false,
  ...props
}: InlineProps) {
  return (
    <Textarea
      className={`
        flex-1 resize-none border-0 bg-card
        text-sm leading-relaxed
        placeholder:text-muted-foreground/50
        focus:ring-0 focus:outline-none
        px-4 py-3
        ${className}
      `.replace(/\s+/g, " ").trim()}
      maxHeight={maxHeight}
      autoGrow={autoGrow}
      {...props}
    />
  )
}

// ============================================================================
// Input.Text - Minimal single-line text input (no borders, no focus state)
// ============================================================================
interface TextProps extends Omit<React.ComponentProps<"input">, "className"> {
  className?: string
}

const Text = React.forwardRef<HTMLInputElement, TextProps>(
  ({ className = "", type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={`
          w-full h-10
          bg-transparent border-0
          px-3 py-2
          text-sm text-foreground
          placeholder:text-muted-foreground/50
          focus:ring-0 focus:outline-none
          disabled:cursor-not-allowed disabled:opacity-50
          ${className}
        `.replace(/\s+/g, " ").trim()}
        {...props}
      />
    )
  }
)
Text.displayName = "IspoInput.Text"

// ============================================================================
// Compound export
// ============================================================================
IspoInput.Label = Label
IspoInput.Textarea = Textarea
IspoInput.Inline = Inline
IspoInput.Text = Text

export { IspoInput }
