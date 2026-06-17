"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, MapPin, Search } from "lucide-react";
import {
  AddressSuggestion,
  hasAddressAutocompleteConfig,
  searchAddressSuggestions,
} from "@/lib/address-autocomplete";

type AddressAutocompleteFieldProps = {
  badge?: string;
  error?: string;
  helpText?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  value: string;
};

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]";

function secondaryLine(suggestion: AddressSuggestion) {
  return [suggestion.city, suggestion.county, suggestion.stateCode || suggestion.state, suggestion.postcode]
    .filter(Boolean)
    .join(", ");
}

export function AddressAutocompleteField({
  badge,
  error,
  helpText,
  id,
  label,
  onChange,
  onSelect,
  value,
}: AddressAutocompleteFieldProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSearch = hasAddressAutocompleteConfig && value.trim().length >= 3;
  const activeSuggestions = useMemo(() => (canSearch ? suggestions.slice(0, 5) : []), [canSearch, suggestions]);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const describedBy = [
    error ? `${inputId}-error` : "",
    helpText ? `${inputId}-help` : "",
    lookupError ? `${inputId}-lookup-error` : "",
  ].filter(Boolean).join(" ") || undefined;

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setLookupError("");

      searchAddressSuggestions(value, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setOpen(results.length > 0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setSuggestions([]);
          setLookupError("Address lookup unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, value]);

  function handleSelect(suggestion: AddressSuggestion) {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }

    setOpen(false);
    setSuggestions([]);
    onSelect(suggestion);
  }

  return (
    <label className="relative block min-w-0 sm:col-span-2">
      <span className="mb-1.5 flex min-h-5 flex-wrap items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <span>{label}</span>
        {badge ? (
          <span className="rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
        <input
          id={inputId}
          value={value}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);

            if (!hasAddressAutocompleteConfig || nextValue.trim().length < 3) {
              setSuggestions([]);
              setLookupError("");
              setLoading(false);
              setOpen(false);
              return;
            }

            setOpen(true);
          }}
          onFocus={() => {
            if (activeSuggestions.length > 0) {
              setOpen(true);
            }
          }}
          autoComplete="street-address"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`${inputClass} pl-9 pr-10 ${error ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20" : ""}`}
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-secondary)]" size={16} />
        ) : null}
      </span>

      {open && activeSuggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[72px] z-30 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl shadow-[var(--color-shadow)]">
          {activeSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(suggestion)}
              className="flex w-full items-start gap-3 border-b border-[var(--color-border)] px-3 py-3 text-left transition last:border-b-0 hover:bg-[var(--color-surface-muted)] focus:bg-[var(--color-surface-muted)] focus:outline-none"
            >
              <MapPin className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" size={16} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {suggestion.addressLine1 || suggestion.formattedAddress}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">
                  {secondaryLine(suggestion) || suggestion.formattedAddress}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {helpText ? <span id={`${inputId}-help`} className="mt-1.5 block text-xs leading-5 text-[var(--color-text-secondary)]">{helpText}</span> : null}
      {error ? (
        <span id={`${inputId}-error`} className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} />
          {error}
        </span>
      ) : null}
      {lookupError ? (
        <span id={`${inputId}-lookup-error`} className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-700">
          <AlertCircle size={14} />
          {lookupError}
        </span>
      ) : null}
    </label>
  );
}
