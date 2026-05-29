import 'dart:convert';

import 'collection_status_helper.dart';

/// Parsed Nestlé recommendation content for the farmer home card.
/// All strings must originate from the performance API / CRUD sync — never Flutter.
class FarmerRecommendationContent {
  final String title;
  final String message;
  final List<String> guidance;
  final String? severity;
  final List<String> issueTags;

  const FarmerRecommendationContent({
    this.title = '',
    this.message = '',
    this.guidance = const [],
    this.severity,
    this.issueTags = const [],
  });

  bool get hasContent => title.isNotEmpty || message.isNotEmpty || guidance.isNotEmpty;
}

/// Reads recommendation content from `/operations?action=performance&type=farmer`.
class FarmerRecommendationHelper {
  static const _empty = FarmerRecommendationContent();

  static String _localeSuffix(String locale) {
    switch (locale.split('_').first.split('-').first.toLowerCase()) {
      case 'si':
        return '_si';
      case 'ta':
        return '_ta';
      default:
        return '_en';
    }
  }

  static String _pickLocalized(
    Map<String, dynamic>? source,
    String base,
    String locale,
  ) {
    if (source == null) return '';
    final suffix = _localeSuffix(locale);
    final localized = source['$base$suffix']?.toString().trim();
    if (localized != null && localized.isNotEmpty) return localized;
    final english = source['${base}_en']?.toString().trim();
    if (english != null && english.isNotEmpty) return english;
    return source[base]?.toString().trim() ?? '';
  }

  static List<String> _pickGuidanceList(
    Map<String, dynamic>? source,
    String locale,
  ) {
    if (source == null) return const [];
    final suffix = _localeSuffix(locale);
    final localized = source['guidance$suffix'] ?? source['tips$suffix'];
    final english = source['guidance_en'] ?? source['tips'];
    final raw = localized ?? english;
    if (raw is List) {
      return raw
          .map((e) => e.toString().trim())
          .where((e) => e.isNotEmpty)
          .toList();
    }
    if (raw is String && raw.trim().isNotEmpty) {
      return [raw.trim()];
    }
    return const [];
  }

  static Map<String, dynamic>? _parseRecommendationJson(
    Map<String, dynamic> performance,
  ) {
    final rec = performance['recommendation'];
    if (rec is Map) return Map<String, dynamic>.from(rec);
    if (rec is! String || !rec.trim().startsWith('{')) return null;
    try {
      final parsed = jsonDecode(rec);
      if (parsed is Map) return Map<String, dynamic>.from(parsed);
    } catch (_) {}
    return null;
  }

  static List<String> _issueTagsFrom(dynamic issue) {
    if (issue == null) return const [];
    return issue
        .toString()
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
  }

  static FarmerRecommendationContent _fromCrudMap(
    Map<String, dynamic> map,
    String locale, {
    required String titleBase,
    required String messageBase,
  }) {
    final title = _pickLocalized(map, titleBase, locale);
    final message = _pickLocalized(map, messageBase, locale);
    final guidance = _pickGuidanceList(map, locale);
    if (title.isEmpty && message.isEmpty && guidance.isEmpty) {
      return _empty;
    }
    return FarmerRecommendationContent(
      title: title,
      message: message,
      guidance: guidance,
      severity: map['severity']?.toString(),
      issueTags: _issueTagsFrom(map['issue_type'] ?? map['issue']),
    );
  }

  /// Nestlé CRUD / synced farmer recommendation only.
  static FarmerRecommendationContent resolveImprovement({
    required Map<String, dynamic> performance,
    required String locale,
  }) {
    if (performance.isEmpty) return _empty;

    final details = performance['recommendationDetails'];
    if (details is Map) {
      final content = _fromCrudMap(
        Map<String, dynamic>.from(details),
        locale,
        titleBase: 'title',
        messageBase: 'description',
      );
      if (content.hasContent) return content;
    }

    final parsed = _parseRecommendationJson(performance);
    if (parsed != null) {
      var content = _fromCrudMap(
        parsed,
        locale,
        titleBase: 'message_title',
        messageBase: 'short_message',
      );
      if (content.guidance.isEmpty) {
        final tips = _pickGuidanceList(
          {
            'tips_en': parsed['tips'],
            'tips_si': parsed['tips_si'],
            'tips_ta': parsed['tips_ta'],
          },
          locale,
        );
        if (tips.isNotEmpty) {
          content = FarmerRecommendationContent(
            title: content.title,
            message: content.message,
            guidance: tips,
            severity: content.severity,
            issueTags: content.issueTags,
          );
        }
      }
      if (content.hasContent) return content;
    }

    final rec = performance['recommendation'];
    if (rec is String && rec.trim().isNotEmpty && !rec.trim().startsWith('{')) {
      return FarmerRecommendationContent(message: rec.trim());
    }

    return _empty;
  }

  /// Good-performance text from the performance API `recommendations` array only.
  static FarmerRecommendationContent resolveGood({
    required Map<String, dynamic> performance,
  }) {
    final tipsRaw = performance['recommendations'];
    if (tipsRaw is! List || tipsRaw.isEmpty) return _empty;

    final tips = tipsRaw
        .map((e) => e.toString().trim())
        .where((e) => e.isNotEmpty)
        .toList();
    if (tips.isEmpty) return _empty;

    return FarmerRecommendationContent(message: tips.first);
  }

  static bool hasCrudRecommendation(Map<String, dynamic> performance) {
    return resolveImprovement(
      performance: performance,
      locale: 'en',
    ).hasContent;
  }

  /// Keep only CRUD issue tags that match actual recent failure reasons.
  static FarmerRecommendationContent filterIssuesByActualFailures(
    FarmerRecommendationContent content,
    List<dynamic> collections,
  ) {
    if (content.issueTags.isEmpty) return content;

    final actual = CollectionStatusHelper.issueTypesFromRecentFailures(collections);
    if (actual.isEmpty) {
      return FarmerRecommendationContent(
        title: content.title,
        message: content.message,
        guidance: content.guidance,
        severity: content.severity,
        issueTags: const [],
      );
    }

    final filtered = content.issueTags.where((tag) {
      final normalized = tag.trim().toUpperCase();
      if (normalized == 'GENERAL' || normalized == 'MULTIPLE') {
        return actual.length > 1;
      }
      return actual.contains(normalized);
    }).toList();

    return FarmerRecommendationContent(
      title: content.title,
      message: content.message,
      guidance: content.guidance,
      severity: content.severity,
      issueTags: filtered,
    );
  }
}
