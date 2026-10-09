"""Evaluation gates are computed from measurements, never a supplied accepted flag."""
MIN_EVALUATION_PER_CLASS = 100


def binary_metrics(labels, probabilities, threshold):
    tp = sum(y == 1 and p >= threshold for y, p in zip(labels, probabilities, strict=True))
    tn = sum(y == 0 and p < threshold for y, p in zip(labels, probabilities, strict=True))
    fp = sum(y == 0 and p >= threshold for y, p in zip(labels, probabilities, strict=True))
    fn = sum(y == 1 and p < threshold for y, p in zip(labels, probabilities, strict=True))
    return {"tp": tp, "tn": tn, "fp": fp, "fn": fn}


def passes_gate(task, report):
    try:
        for split in ("validation", "test"):
            measurement = report[split]
            if task == "ocr":
                total, correct = measurement["total"], measurement["exactMatches"]
                if type(total) is not int or type(correct) is not int or not 0 <= correct <= total:
                    return False
                if total < 100 or correct / total < .95:
                    return False
            else:
                tp, tn, fp, fn = (measurement[key] for key in ("tp", "tn", "fp", "fn"))
                if any(type(n) is not int or n < 0 for n in (tp, tn, fp, fn)):
                    return False
                if min(tp + fn, tn + fp) < MIN_EVALUATION_PER_CLASS:
                    return False
                sensitivity, specificity = tp / (tp + fn), tn / (tn + fp)
                if task == "tampering":
                    if sensitivity < .99 or specificity < .90:
                        return False
                elif sensitivity < .90 or specificity < .99:
                    return False
        return task in ("face", "liveness", "tampering", "ocr")
    except (KeyError, TypeError, ZeroDivisionError):
        return False
