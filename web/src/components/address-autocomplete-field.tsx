"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, MapPin, Search } from "lucide-react";
import {
  AddressSuggestion,
  hasAddressAutocompleteConfig,
  searchAddressSuggestions,
} from "@/lib/address-autocomplete";

type AddressAutocompleteFieldProps = {
  label: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  value: string;
};

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20";

function secondaryLine(suggestion: AddressSuggestion) {
  return [suggestion.city, suggestion.county, suggestion.stateCode || suggestion.state, suggestion.postcode]
    .filter(Boolean)
    .join(", ");
}

export function AddressAutocompleteField({
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
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
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
          className={`${inputClass} pl-9 pr-10`}
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} />
        ) : null}
      </span>

      {open && activeSuggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[72px] z-30 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
          {activeSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(suggestion)}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-[#f8faf7] focus:bg-[#f8faf7] focus:outline-none"
            >
              <MapPin className="mt-0.5 shrink-0 text-[#1b365d]" size={16} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {suggestion.addressLine1 || suggestion.formattedAddress}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {secondaryLine(suggestion) || suggestion.formattedAddress}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {lookupError ? (
        <span className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-700">
          <AlertCircle size={14} />
          {lookupError}
        </span>
      ) : null}
    </label>
  );
}
