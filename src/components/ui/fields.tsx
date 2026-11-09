// Дополнительные типы полей форм: многострочное поле и выпадающий список.
// Оформлены так же, как TextField, чтобы формы выглядели одинаково.

import { Select } from "./select";
import { ERROR_TEXT_CLASS, HINT_CLASS, LABEL_CLASS, inputClass } from "./styles";


export function TextareaField({
  label,
  name,
  rows = 5,
  defaultValue,
  placeholder,
  hint,
  error,
}: {
  label: string;
  name: string;
  rows?: number;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(error, "mt-1.5")}
      />
      {hint && !error && <p className={HINT_CLASS}>{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className={ERROR_TEXT_CLASS}>{error}</p>}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
  error,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  error?: string;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <Select
        id={id}
        name={name}
        defaultValue={defaultValue}
        options={options}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : undefined}
        className="mt-1.5"
      />
      {hint && !error && <p className={HINT_CLASS}>{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className={ERROR_TEXT_CLASS}>{error}</p>}
    </div>
  );
}
