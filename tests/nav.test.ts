import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/app-nav";
import { can } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

// Меню — это удобство, а не защита: те же права проверяются на сервере.
// Но если пункт «Система» покажется обычному администратору, он решит,
// что раздел ему доступен, и упрётся в «страница не найдена».

function visible(role: Role, isSuperAdmin: boolean) {
  return NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isSuperAdmin) return false;
    return !item.permission || can(role, item.permission);
  }).map((item) => item.href);
}

describe("Пункты меню", () => {
  it("раздел «Система» виден только владельцу системы", () => {
    expect(visible("ADMIN", false)).not.toContain("/system");
    expect(visible("RECRUITER", false)).not.toContain("/system");
    expect(visible("HIRING_MANAGER", false)).not.toContain("/system");
    expect(visible("ADMIN", true)).toContain("/system");
  });

  it("владелец системы не получает лишних пунктов своей компании", () => {
    // Права внутри компании остаются прежними: рекрутер-владелец
    // по-прежнему не управляет пользователями своей компании.
    expect(visible("RECRUITER", true)).not.toContain("/users");
    expect(visible("RECRUITER", true)).toContain("/system");
  });

  it("нанимающий менеджер видит только базовые разделы", () => {
    const items = visible("HIRING_MANAGER", false);
    expect(items).toContain("/dashboard");
    expect(items).not.toContain("/analytics");
    expect(items).not.toContain("/users");
  });
});
