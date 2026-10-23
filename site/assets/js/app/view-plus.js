import { h, icon, button, clear } from "./dom.js";
import { animateFrom } from "./motion.js";

const PLANS = [
  { key: "yearly", name: "Yearly", price: "USD 34.99", unit: "a year", note: "7 days free, then USD 34.99 a year. Save 42%.", badge: "Best value" },
  { key: "monthly", name: "Monthly", price: "USD 4.99", unit: "a month", note: "USD 4.99 a month. Cancel any time." },
  { key: "lifetime", name: "Lifetime", price: "USD 79.99", unit: "once", note: "USD 79.99, paid once." },
];

const FEATURES = [
  "Khatm plan with a daily page count",
  "Notes on any ayah",
  "Full-length adhan alarms",
  "Themes and more than one place",
];

const TERMS = {
  yearly: "7 days free, then USD 34.99 a year. Renews until cancelled.",
  monthly: "USD 4.99 a month. Renews until cancelled.",
  lifetime: "USD 79.99 once. No renewal.",
};

export function createPlusSheet(ctx, { context } = {}) {
  const refs = {};
  let plan = ctx.store.plusPlan || "yearly";
  let state = "idle";
  let timer = null;

  refs.plans = h("div", { class: "qplus-plans", role: "radiogroup", "aria-label": "Plan" });
  refs.terms = h("p", { class: "qplus-terms" });
  refs.status = h("p", { class: "qplus-status", role: "status", "aria-live": "polite" });
  refs.cta = button("", "qb-plus qb-wide", () => buy());

  function paintPlans() {
    clear(refs.plans);
    PLANS.forEach((entry) => {
      const isOn = entry.key === plan;
      const card = h("button", { type: "button", role: "radio", "aria-checked": String(isOn), class: `qplus-plan qpress${isOn ? " is-on" : ""}`, disabled: state === "waiting", onClick: () => { plan = entry.key; ctx.store.plusPlan = plan; paintPlans(); paintCta(); } },
        h("span", { class: "qm-radio", "aria-hidden": "true" }, isOn ? icon("check", { size: 16, width: 2.6 }) : null),
        h("span", { class: "qplus-plan-copy" },
          h("span", { class: "qplus-plan-name" }, entry.name, entry.badge ? h("span", { class: "qplus-badge" }, entry.badge) : null),
          h("span", { class: "qplus-plan-note" }, entry.note),
        ),
        h("span", { class: "qplus-price" }, h("strong", {}, entry.price), h("span", {}, entry.unit)),
      );
      refs.plans.append(card);
    });
  }

  function paintCta() {
    refs.terms.textContent = TERMS[plan];
    refs.cta.disabled = state === "waiting";
    clear(refs.cta);

    if (state === "waiting") {
      refs.cta.append(h("span", { class: "qspinner", "aria-hidden": "true" }), "Waiting for Apple");
      refs.status.textContent = "";
      return;
    }
    if (state === "done") {
      refs.cta.append("Close");
      refs.status.textContent = "Preview only. Nothing was purchased.";
      return;
    }
    refs.cta.append(plan === "yearly" ? "Start 7 days free" : plan === "monthly" ? "Subscribe for USD 4.99" : "Buy for USD 79.99");
    refs.status.textContent = "";
  }

  function buy() {
    if (state === "done") {
      ctx.closeSheet();
      return;
    }
    state = "waiting";
    paintPlans();
    paintCta();
    const wait = ctx.reduced() ? 700 : 1600;
    timer = setTimeout(() => {
      state = "done";
      paintPlans();
      paintCta();
      animateFrom(refs.status, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity" });
      ctx.glint?.();
    }, wait);
  }

  const el = h("div", { class: "qs-body qplus" },
    h("div", { class: "qs-head" },
      h("span", { class: "qplus-mark" }, "Qalm ", h("em", {}, "Plus")),
      h("button", { type: "button", class: "qs-close qpress", onClick: () => ctx.closeSheet() }, "Close"),
    ),
    h("div", { class: "qplus-banner" }, icon("check", { size: 18, width: 2.4 }), "Prayer times, alerts and Qibla stay free."),
    h("h2", { class: "qplus-title" }, "Plus adds"),
    h("ul", { class: "qplus-list" }, ...FEATURES.map((text) => h("li", {}, icon("check", { size: 18, width: 2.2 }), text))),
    refs.plans,
    h("div", { class: "qplus-foot" }, refs.cta, refs.terms, refs.status),
  );

  paintPlans();
  paintCta();
  return { el, label: context ? `Qalm Plus, from ${context}` : "Qalm Plus", tall: true, dark: true, onClose: () => clearTimeout(timer) };
}
