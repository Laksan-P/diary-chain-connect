import 'collection_status_helper.dart';

enum FarmerRecommendationVisibility {
  hidden,
  showCrud,
  showFallback,
}

/// Mirrors Nestlé `performanceAnalytics.js` rules for offline/fallback display.
/// Primary source should always be `/operations?action=performance&type=farmer`.
class FarmerPerformanceHelper {
  static const passRateThreshold = 70;
  static const _inspectedLower = {'approved', 'rejected', 'paid'};
  static const _passedLower = {'approved', 'paid'};

  static String? _dispatchStatusNormalized(dynamic col) {
    final raw = col['dispatchStatus'] ?? col['dispatch_status'];
    final value = raw?.toString().trim().toLowerCase();
    if (value == null || value.isEmpty) return null;
    return value;
  }

  static bool isNestleInspected(dynamic col) {
    final status = _dispatchStatusNormalized(col);
    return status != null && _inspectedLower.contains(status);
  }

  static bool isNestlePassed(dynamic col) {
    final status = _dispatchStatusNormalized(col);
    return status != null && _passedLower.contains(status);
  }

  static ({
    double? passRate,
    int inspectedCount,
    int passedCount,
    String status,
  }) calculateFromCollections(List<dynamic> collections) {
    final inspected = collections.where(isNestleInspected).toList();
    if (inspected.isEmpty) {
      return (
        passRate: null,
        inspectedCount: 0,
        passedCount: 0,
        status: 'Not Enough Data',
      );
    }

    final passed = inspected.where(isNestlePassed).length;
    final passRate = double.parse(
      ((passed / inspected.length) * 100).toStringAsFixed(1),
    );

    return (
      passRate: passRate,
      inspectedCount: inspected.length,
      passedCount: passed,
      status: deriveStatusFromPassRate(passRate, inspected.length),
    );
  }

  static ({
    double? passRate,
    int inspectedCount,
    String status,
  }) fromPerformanceMap(Map<String, dynamic> performance) {
    if (performance.isEmpty) {
      return (passRate: null, inspectedCount: 0, status: 'Not Enough Data');
    }

    final inspectedCount = (performance['inspectedCount'] as num?)?.toInt() ?? 0;
    final passRateRaw = performance['passRateDisplay'];
    final passRate = passRateRaw == null ? null : (passRateRaw as num).toDouble();

    return (
      passRate: passRate,
      inspectedCount: inspectedCount,
      status: deriveStatusFromPassRate(passRate, inspectedCount),
    );
  }

  static String deriveStatusFromPassRate(double? passRate, int inspectedCount) {
    if (inspectedCount == 0 || passRate == null) return 'Not Enough Data';
    if (isPassingPassRate(passRate)) return 'Good';
    return 'Needs Improvement';
  }

  static bool isPassingPassRate(double? passRate) {
    return passRate != null && passRate >= passRateThreshold;
  }

  static ({
    double? passRate,
    int inspectedCount,
    String status,
  }) resolveMetrics({
    required List<dynamic> collections,
    Map<String, dynamic> performance = const {},
  }) {
    final local = calculateFromCollections(collections);
    if (performance.isEmpty) {
      return (
        passRate: local.passRate,
        inspectedCount: local.inspectedCount,
        status: local.status,
      );
    }

    final api = fromPerformanceMap(performance);
    if (api.inspectedCount > 0) {
      return (
        passRate: api.passRate,
        inspectedCount: api.inspectedCount,
        status: deriveStatusFromPassRate(api.passRate, api.inspectedCount),
      );
    }

    return (
      passRate: local.passRate,
      inspectedCount: local.inspectedCount,
      status: local.status,
    );
  }

  /// Failures in the current streak (newest first), stopping at the latest pass.
  static int _recentFailureStreak(List<dynamic> collections) {
    final sorted = List<dynamic>.from(collections)
      ..sort(CollectionStatusHelper.compareCollections);

    var count = 0;
    for (final col in sorted) {
      if (CollectionStatusHelper.isQualityPass(col)) break;
      if (CollectionStatusHelper.isQualityFailureRecord(col)) {
        count++;
      }
    }
    return count;
  }

  static bool hasActiveRepeatedFailures(
    List<dynamic> collections, {
    int threshold = 3,
  }) {
    final latest = CollectionStatusHelper.latestQualityTested(collections);
    if (latest != null && CollectionStatusHelper.isQualityPass(latest)) {
      return false;
    }
    return _recentFailureStreak(collections) >= threshold;
  }

  @Deprecated('Use hasActiveRepeatedFailures')
  static bool hasRepeatedQualityFailures(
    List<dynamic> collections, {
    int threshold = 3,
  }) {
    return hasActiveRepeatedFailures(collections, threshold: threshold);
  }

  static bool shouldShowRecommendationSection({
    required List<dynamic> collections,
    Map<String, dynamic> performance = const {},
  }) {
    return resolveRecommendationVisibility(
          collections: collections,
          performance: performance,
        ) !=
        FarmerRecommendationVisibility.hidden;
  }

  static FarmerRecommendationVisibility resolveRecommendationVisibility({
    required List<dynamic> collections,
    Map<String, dynamic> performance = const {},
  }) {
    final latest = CollectionStatusHelper.latestQualityTested(collections);

    // Latest quality pass resolves all prior failures — hide recommendations.
    if (latest != null && CollectionStatusHelper.isQualityPass(latest)) {
      return FarmerRecommendationVisibility.hidden;
    }

    final metrics = resolveMetrics(
      collections: collections,
      performance: performance,
    );

    final latestFailed =
        latest != null && CollectionStatusHelper.isQualityFail(latest);
    final passRateLow = metrics.inspectedCount > 0 &&
        metrics.passRate != null &&
        !isPassingPassRate(metrics.passRate);
    final repeatedActive = hasActiveRepeatedFailures(collections);

    if (!passRateLow && !latestFailed && !repeatedActive) {
      return FarmerRecommendationVisibility.hidden;
    }

    return FarmerRecommendationVisibility.showCrud;
  }

  static String resolvePerformanceStatus({
    required List<dynamic> collections,
    Map<String, dynamic> performance = const {},
  }) {
    return resolveMetrics(
      collections: collections,
      performance: performance,
    ).status;
  }
}
