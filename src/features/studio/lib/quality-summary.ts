import { fitDeck } from "@/design/fit";
import { evaluateDeck } from "@/design/quality";
import { resolveTemplate } from "@/design/templates";
import type { DesignDocument } from "@/design/types";

/** Cheap pass/fail summary for the studio sidebar. */
export function evaluateQuick(document_: DesignDocument): {
  passed: boolean;
  errors: number;
  warnings: number;
} {
  const template = resolveTemplate(document_.templateId, document_.overrides);
  const fit = fitDeck(document_.slides, template);
  const report = evaluateDeck(document_.slides, template, fit);

  return {
    passed: report.passed,
    errors: report.issues.filter((issue) => issue.severity === "error").length,
    warnings: report.issues.filter((issue) => issue.severity === "warning").length,
  };
}
