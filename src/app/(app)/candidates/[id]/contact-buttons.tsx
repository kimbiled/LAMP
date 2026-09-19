import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import {
  emailLink,
  firstMessage,
  telLink,
  telegramLink,
  whatsappLink,
} from "@/lib/contacts";

// Четыре кнопки связи. Это обычные ссылки: система ничего никуда
// не отправляет и не хранит переписку.

export function ContactButtons({
  candidateName,
  phone,
  email,
  telegram,
  recruiterName,
  companyName,
  jobTitle,
}: {
  candidateName: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  recruiterName: string;
  companyName: string;
  jobTitle?: string | null;
}) {
  const message = firstMessage({
    candidateName,
    recruiterName,
    companyName,
    jobTitle,
  });

  const buttons = [
    {
      label: "Позвонить",
      href: telLink(phone),
      icon: Phone,
      external: false,
      missing: "Телефон не указан",
    },
    {
      label: "WhatsApp",
      href: whatsappLink(phone, message),
      icon: MessageCircle,
      external: true,
      missing: "Телефон не указан",
    },
    {
      label: "Telegram",
      href: telegramLink(telegram),
      icon: Send,
      external: true,
      missing: "Telegram не указан",
    },
    {
      label: "Email",
      href: emailLink(email),
      icon: Mail,
      external: false,
      missing: "Почта не указана",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {buttons.map((button) => {
        const Icon = button.icon;

        if (!button.href) {
          return (
            <span
              key={button.label}
              title={button.missing}
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-muted px-3 py-2.5 text-sm text-ink-soft opacity-50"
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {button.label}
            </span>
          );
        }

        return (
          <a
            key={button.label}
            href={button.href}
            target={button.external ? "_blank" : undefined}
            rel={button.external ? "noopener noreferrer" : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-muted px-3 py-2.5 text-sm text-ink transition hover:border-ink-soft hover:bg-canvas"
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            {button.label}
          </a>
        );
      })}
    </div>
  );
}
