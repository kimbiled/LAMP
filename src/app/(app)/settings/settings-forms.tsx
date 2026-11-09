"use client";

import { useActionState, useState } from "react";
import {
  changeOwnPassword,
  updateCompany,
  updateOwnProfile,
  updateWorkSettings,
  type SettingsFormState,
} from "@/app/actions/settings";
import {
  DEFAULT_INVITE_TEMPLATE,
  INVITE_PLACEHOLDERS,
  MAX_TEMPLATE_LENGTH,
} from "@/lib/invite-template";
import { ERROR_TEXT_CLASS, HINT_CLASS, LABEL_CLASS, inputClass } from "@/components/ui/styles";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: SettingsFormState = {};

function Message({ state }: { state: SettingsFormState }) {
  if (state.formError) {
    return (
      <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
        {state.formError}
      </div>
    );
  }
  if (state.success) {
    return (
      <div className="rounded-lg border border-line bg-muted px-3 py-2.5 text-sm text-ink">
        {state.success}
      </div>
    );
  }
  return null;
}

export function CompanyForm({
  name,
  meetingLink,
  staleDays,
}: {
  name: string;
  meetingLink: string;
  staleDays: number;
}) {
  const [state, formAction] = useActionState(updateCompany, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Название компании"
        name="name"
        required
        defaultValue={name}
        error={state.fieldErrors?.name}
      />

      <TextField
        label="Общая ссылка на встречу"
        name="meetingLink"
        placeholder="https://meet.google.com/abc-defg-hij"
        hint="Запасная: подставляется тем, кто ещё не назначил свою ссылку в блоке «Встречи и приглашения»"
        defaultValue={meetingLink}
        error={state.fieldErrors?.meetingLink}
      />

      <div className="max-w-xs">
        <TextField
          label="Срок простоя кандидата, дней"
          name="staleDays"
          type="number"
          defaultValue={String(staleDays)}
          hint="Сколько дней кандидат может стоять на одном этапе, прежде чем его подсветят жёлтым. Действует для всех; рекрутер может задать свой срок для своих кандидатов"
          error={state.fieldErrors?.staleDays}
        />
      </div>

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changeOwnPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Текущий пароль"
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
      />

      <TextField
        label="Новый пароль"
        name="newPassword"
        type="password"
        required
        autoComplete="new-password"
        hint="Не короче 8 символов"
        error={state.fieldErrors?.newPassword}
      />

      <TextField
        label="Повторите новый пароль"
        name="newPasswordConfirm"
        type="password"
        required
        autoComplete="new-password"
        error={state.fieldErrors?.newPasswordConfirm}
      />

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Меняем…">Изменить пароль</SubmitButton>
      </div>
    </form>
  );
}

export function ProfileForm({
  fullName,
  position,
}: {
  fullName: string;
  position: string;
}) {
  const [state, formAction] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Имя и фамилия"
        name="fullName"
        required
        defaultValue={fullName}
        error={state.fieldErrors?.fullName}
      />

      <TextField
        label="Должность"
        name="position"
        placeholder="Руководитель отдела маркетинга"
        hint="Видна коллегам рядом с вашими отзывами по кандидатам"
        defaultValue={position}
        error={state.fieldErrors?.position}
      />

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
      </div>
    </form>
  );
}

// Встречи и приглашения: своя постоянная комната Google Meet, текст
// приглашения для кнопки «Скопировать приглашение» и (у рекрутера)
// свой срок простоя для своих кандидатов.
export function WorkForm({
  meetingLink,
  inviteTemplate,
  staleDays,
  companyStaleDays,
  showStaleDays,
}: {
  meetingLink: string;
  inviteTemplate: string;
  staleDays: number | null;
  companyStaleDays: number;
  showStaleDays: boolean;
}) {
  const [state, formAction] = useActionState(updateWorkSettings, initialState);
  const [template, setTemplate] = useState(inviteTemplate || DEFAULT_INVITE_TEMPLATE);

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />

      <TextField
        label="Моя ссылка Google Meet"
        name="meetingLink"
        placeholder="https://meet.google.com/abc-defg-hij"
        hint="Постоянная комната: кнопка «Google Meet» в интервью подставит её сама. Создать комнату: meet.google.com/new"
        defaultValue={meetingLink}
        error={state.fieldErrors?.meetingLink}
      />

      <div>
        <label htmlFor="inviteTemplate" className={LABEL_CLASS}>
          Текст приглашения
        </label>
        <textarea
          id="inviteTemplate"
          name="inviteTemplate"
          rows={12}
          maxLength={MAX_TEMPLATE_LENGTH}
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          className={inputClass(state.fieldErrors?.inviteTemplate, "mt-1.5 font-mono text-[13px] leading-relaxed")}
        />
        {state.fieldErrors?.inviteTemplate && (
          <p className={ERROR_TEXT_CLASS}>{state.fieldErrors.inviteTemplate}</p>
        )}
        <p className={HINT_CLASS}>
          Копируется кнопкой «Скопировать приглашение» в форме интервью.
          Метки в фигурных скобках заменяются данными встречи — нажмите
          на метку, чтобы добавить её в конец текста:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {INVITE_PLACEHOLDERS.map((item) => (
            <button
              key={item.key}
              type="button"
              title={item.hint}
              onClick={() => setTemplate((value) => `${value}{${item.key}}`)}
              className="rounded-md border border-line bg-canvas px-2 py-0.5 font-mono text-xs text-ink transition hover:border-ink-soft"
            >
              {`{${item.key}}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTemplate(DEFAULT_INVITE_TEMPLATE)}
            className="rounded-md px-2 py-0.5 text-xs text-ink-soft underline transition hover:text-ink"
          >
            Вернуть текст по умолчанию
          </button>
        </div>
      </div>

      {showStaleDays && (
        <div className="max-w-xs">
          <TextField
            label="Срок простоя моих кандидатов, дней"
            name="staleDays"
            type="number"
            defaultValue={staleDays === null ? "" : String(staleDays)}
            placeholder={String(companyStaleDays)}
            hint={`Для кандидатов, которых добавили вы. Пусто — общий срок компании: ${companyStaleDays} дн.`}
            error={state.fieldErrors?.staleDays}
          />
        </div>
      )}

      <div className="sm:w-48">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить</SubmitButton>
      </div>
    </form>
  );
}
