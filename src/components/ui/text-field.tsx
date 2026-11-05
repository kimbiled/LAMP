import { ERROR_TEXT_CLASS, HINT_CLASS, LABEL_CLASS, inputClass } from "./styles";

type TextFieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
};

// Одно поле формы: подпись, поле ввода и сообщение об ошибке.
// Используется во всех формах, чтобы они выглядели одинаково.

export function TextField({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  defaultValue,
  placeholder,
  hint,
  error,
}: TextFieldProps) {
  const id = `field-${name}`;

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(error, "mt-1.5")}
      />
      {hint && !error && <p className={HINT_CLASS}>{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className={ERROR_TEXT_CLASS}>
          {error}
        </p>
      )}
    </div>
  );
}
