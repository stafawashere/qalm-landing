import { h, icon, button } from "./dom.js";

export function plusChip(label = "Plus") {
  return h("span", { class: "qchip-plus" }, label);
}

export function soonChip(label = "Coming in v1.0") {
  return h("span", { class: "qchip-soon" }, label);
}

export function gateCard(ctx, { title, body, context }) {
  return h("section", { class: "qgate", "aria-label": title },
    icon("flag", { size: 28, width: 1.7 }),
    h("h3", { class: "qgate-title" }, title),
    h("p", { class: "qgate-body" }, body),
    h("div", { class: "qgate-actions" },
      button("See Plus", "qb-primary qb-sm", () => ctx.openSheet("plus", { context })),
    ),
  );
}

export function sectionLabel(text) {
  return h("h3", { class: "qsec-label" }, text);
}

export function viewScroll(className, ...children) {
  return h("div", { class: `qv-scroll ${className}`.trim(), "data-lenis-prevent": "", tabindex: "-1" }, ...children);
}
