"use client";

import { createContext, useContext, useState } from "react";

// Настройки встреч текущего человека, доступные любой форме интервью:
// его постоянная комната Google Meet и шаблон приглашения.
//
// Кладутся один раз в оболочку приложения, чтобы не протаскивать
// их через каждую страницу. Ссылку можно задать прямо из формы
// интервью — тогда она сразу появляется и во всех остальных формах.

type MeetingDefaults = {
  link: string | null;
  template: string;
  recruiterName: string;
  companyName: string;
  setLink: (link: string) => void;
};

const Context = createContext<MeetingDefaults | null>(null);

export function MeetingDefaultsProvider({
  link,
  template,
  recruiterName,
  companyName,
  children,
}: {
  link: string | null;
  template: string;
  recruiterName: string;
  companyName: string;
  children: React.ReactNode;
}) {
  const [current, setLink] = useState(link);

  return (
    <Context.Provider
      value={{ link: current, template, recruiterName, companyName, setLink }}
    >
      {children}
    </Context.Provider>
  );
}

export function useMeetingDefaults(): MeetingDefaults {
  return (
    useContext(Context) ?? {
      link: null,
      template: "",
      recruiterName: "",
      companyName: "",
      setLink: () => {},
    }
  );
}
