import { ModelEvaluation, StockForecast } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Info } from "lucide-react";

interface ModelMetricsProps {
  evaluations: ModelEvaluation[];
  forecasts: StockForecast[];
  lastClose: string | null;
}

function skillVerdict(evaluation: ModelEvaluation) {
  const rmse = evaluation.rmse ? parseFloat(evaluation.rmse) : null;
  const naive = evaluation.naiveRmse ? parseFloat(evaluation.naiveRmse) : null;

  if (rmse === null || naive === null) {
    return { label: "Not measured", className: "text-muted-foreground" };
  }
  // A model only adds information if it beats a random walk on the same window.
  if (rmse < naive) {
    return { label: "Beats random walk", className: "text-emerald-500" };
  }
  return { label: "No better than random walk", className: "text-amber-500" };
}

export function ModelMetrics({ evaluations, forecasts, lastClose }: ModelMetricsProps) {
  if (evaluations.length === 0 && forecasts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          No model output yet. Forecasts appear once the pipeline has enough
          price history for this stock.
        </p>
      </div>
    );
  }

  const models = Array.from(new Set(forecasts.map((f) => f.modelName))).sort();
  const base = lastClose ? parseFloat(lastClose) : null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Backtested accuracy for each forecasting model
          </caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-3 text-left font-medium">Model</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">MAPE</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">RMSE</th>
              <th scope="col" className="px-4 py-3 text-right font-medium hidden sm:table-cell">
                Random walk RMSE
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium hidden md:table-cell">
                Direction
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Skill</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((evaluation) => {
              const verdict = skillVerdict(evaluation);
              const direction = evaluation.directionalAccuracy
                ? `${(parseFloat(evaluation.directionalAccuracy) * 100).toFixed(1)}%`
                : "—";
              return (
                <tr key={evaluation.evaluationId} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{evaluation.modelName}</span>
                    {evaluation.params && (
                      <span className="block text-xs text-muted-foreground">
                        {evaluation.params}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {evaluation.mape ? `${parseFloat(evaluation.mape).toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {evaluation.rmse ? parseFloat(evaluation.rmse).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                    {evaluation.naiveRmse ? parseFloat(evaluation.naiveRmse).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">{direction}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${verdict.className}`}>
                    {verdict.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {models.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Forecast values by target date</caption>
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="px-4 py-3 text-left font-medium">Target date</th>
                {models.map((model) => (
                  <th key={model} scope="col" className="px-4 py-3 text-right font-medium">
                    {model}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(forecasts.map((f) => f.targetDate)))
                .sort()
                .map((targetDate) => (
                  <tr key={targetDate} className="border-b last:border-0">
                    <td className="px-4 py-3">{formatDate(targetDate)}</td>
                    {models.map((model) => {
                      const match = forecasts.find(
                        (f) => f.targetDate === targetDate && f.modelName === model
                      );
                      if (!match) {
                        return (
                          <td key={model} className="px-4 py-3 text-right text-muted-foreground">
                            —
                          </td>
                        );
                      }
                      const predicted = parseFloat(match.predictedClose);
                      const delta = base !== null ? ((predicted - base) / base) * 100 : null;
                      return (
                        <td key={model} className="px-4 py-3 text-right">
                          <span className="font-medium">{formatCurrency(predicted)}</span>
                          {delta !== null && (
                            <span className="block text-xs text-muted-foreground">
                              {delta >= 0 ? "+" : ""}{delta.toFixed(2)}% vs last close
                            </span>
                          )}
                          {match.lowerBound && match.upperBound && (
                            <span className="block text-xs text-muted-foreground">
                              {formatCurrency(match.lowerBound)} – {formatCurrency(match.upperBound)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>
            These are statistical extrapolations of past prices produced by ARIMA
            and XGBoost models, shown for academic purposes. Metrics come from a
            walk-forward backtest on data the models were not trained on.
          </p>
          <p>
            MAPE is mean absolute percentage error and RMSE is root mean squared
            error, both lower-is-better. Direction is how often the predicted
            up/down move matched reality, where 50% is a coin flip. The random
            walk column predicts that tomorrow equals today; a model that does
            not beat it carries no predictive information.
          </p>
          <p>
            Nothing here is investment advice or a recommendation to buy, sell or
            hold any security. Past price behaviour does not determine future
            returns.
          </p>
        </div>
      </div>
    </div>
  );
}
