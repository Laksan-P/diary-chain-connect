import '../services/translations.dart';

/// Frontend-only helpers for milk collection quality and dispatch display.
class CollectionStatusHelper {
  static int compareCollections(dynamic a, dynamic b) {
    final da = '${a['date'] ?? ''} ${a['time'] ?? '00:00:00'}';
    final db = '${b['date'] ?? ''} ${b['time'] ?? '00:00:00'}';
    return db.compareTo(da);
  }

  static dynamic latestForDate(List<dynamic> collections, String datePrefix) {
    final matched = collections.where((c) {
      final d = c['date']?.toString() ?? '';
      return d.startsWith(datePrefix);
    }).toList();
    if (matched.isEmpty) return null;
    matched.sort(compareCollections);
    return matched.first;
  }

  static String? qualityResultRaw(dynamic col) {
    final raw = col['qualityResult'] ??
        col['quality'] ??
        col['quality_result'] ??
        col['qualityStatus'];
    final value = raw?.toString().trim().toLowerCase();
    if (value == null || value.isEmpty) return null;
    return value;
  }

  static bool isQualityFailureRecord(dynamic col) {
    if (isFailedOrRejected(col)) return true;
    if (isQualityPass(col)) return false;
    final reason = failureReason(col);
    return reason != null && reason.isNotEmpty;
  }

  static bool isQualityFail(dynamic col) {
    final q = qualityResultRaw(col);
    return q == 'fail' || q == 'failed';
  }

  static bool isQualityPass(dynamic col) {
    final q = qualityResultRaw(col);
    return q == 'pass' || q == 'passed';
  }

  static String? normalizeDispatchStatus(dynamic col) {
    final raw = col['dispatchStatus'] ?? col['dispatch_status'];
    final value = raw?.toString().trim().toLowerCase();
    if (value == null || value.isEmpty) return null;
    return value;
  }

  static bool isFailedOrRejected(dynamic col) {
    if (isQualityFail(col)) return true;
    return normalizeDispatchStatus(col) == 'rejected';
  }

  static String qualityDisplayKey(dynamic col) {
    if (isQualityFail(col)) return 'quality_failed';
    if (isQualityPass(col)) return 'quality_passed';
    return 'quality_pending';
  }

  static String collectionDisplayKey(dynamic col) {
    if (isQualityFail(col)) return 'collection_rejected';

    final dispatch = normalizeDispatchStatus(col);
    if (dispatch == 'rejected') return 'collection_rejected';

    if (isQualityPass(col)) {
      switch (dispatch) {
        case 'paid':
          return 'collection_paid';
        case 'approved':
          return 'collection_approved';
        case 'dispatched':
          return 'collection_dispatched';
        case 'rejected':
          return 'collection_rejected';
        case 'pending':
        case null:
        case '':
          return 'collection_pending';
        default:
          return 'collection_pending';
      }
    }

    return 'collection_pending';
  }

  static dynamic latestQualityTested(List<dynamic> collections) {
    final sorted = List<dynamic>.from(collections)
      ..sort(compareCollections);
    for (final col in sorted) {
      final q = qualityResultRaw(col);
      if (q == 'pass' ||
          q == 'passed' ||
          q == 'fail' ||
          q == 'failed') {
        return col;
      }
    }
    return null;
  }

  /// Issue codes (SNF, FAT, WATER) found in recent failed collections.
  static Set<String> issueTypesFromRecentFailures(List<dynamic> collections) {
    final sorted = List<dynamic>.from(collections)
      ..sort(compareCollections);
    final issues = <String>{};

    for (final col in sorted) {
      if (isQualityPass(col)) break;
      if (!isQualityFailureRecord(col)) continue;
      final reason = failureReason(col)?.toLowerCase() ?? '';
      if (reason.contains('snf')) issues.add('SNF');
      if (reason.contains('water')) issues.add('WATER');
      if (reason.contains('fat')) issues.add('FAT');
    }
    return issues;
  }

  static String? failureReason(dynamic col) {
    for (final key in [
      'failureReason',
      'failure_reason',
      'reason',
      'rejectionReason',
      'qualityReason',
      'rejectReason',
    ]) {
      final value = col[key]?.toString().trim();
      if (value != null &&
          value.isNotEmpty &&
          value.toLowerCase() != 'n/a') {
        return value;
      }
    }
    return null;
  }

  static String translatedStatusLabel(String? displayKey, String locale) {
    final key = (displayKey == null || displayKey.isEmpty)
        ? 'quality_pending'
        : displayKey;
    return Translations.labelForKey(key, locale);
  }

  static String translatedFailureReason(dynamic col, String locale) {
    final raw = failureReason(col);
    if (raw == null || raw.isEmpty) return '';
    return Translations.translateReason(raw, locale);
  }

  static List<String> guidanceKeysFromFailures(List<dynamic> collections) {
    final failed = collections.where(isQualityFailureRecord).toList();
    if (failed.isEmpty) return const ['quality_failure_guidance'];

    var hasLowSnf = false;
    var hasExcessWater = false;
    var hasLowFat = false;

    for (final col in failed) {
      final reason = failureReason(col)?.toLowerCase() ?? '';
      if (reason.contains('snf')) hasLowSnf = true;
      if (reason.contains('water')) hasExcessWater = true;
      if (reason.contains('fat')) hasLowFat = true;
    }

    final specific = <String>[];
    if (hasLowSnf) specific.add('low_snf_guidance');
    if (hasExcessWater) specific.add('excess_water_guidance');
    if (hasLowFat) specific.add('low_fat_guidance');

    if (specific.length > 1) {
      return ['multiple_quality_issues_guidance', ...specific];
    }
    if (specific.length == 1) return specific;
    return const ['quality_failure_guidance'];
  }
}
