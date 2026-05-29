import 'package:flutter/material.dart';
import '../services/translations.dart';
import '../theme/design_tokens.dart';

enum StatusChipType { pass, fail, pending, paid, approved, rejected, dispatched, sync }

class StatusChip extends StatelessWidget {
  final String status;
  final String locale;
  final bool compact;
  final String? displayKey;

  const StatusChip({
    super.key,
    required this.status,
    required this.locale,
    this.compact = false,
    this.displayKey,
  });

  StatusChipType get _type {
    final key = displayKey?.toLowerCase() ?? '';
    if (key.contains('fail') ||
        key == 'quality_failed' ||
        key == 'collection_rejected') {
      return StatusChipType.fail;
    }
    if (key.contains('pass') || key == 'quality_passed') {
      return StatusChipType.pass;
    }
    if (key == 'collection_paid') return StatusChipType.paid;
    if (key == 'collection_approved') return StatusChipType.approved;
    if (key == 'collection_dispatched') return StatusChipType.dispatched;
    if (key == 'collection_rejected') return StatusChipType.rejected;
    if (key == 'not_inspected_yet' ||
        key == 'collection_pending' ||
        key == 'quality_pending') {
      return StatusChipType.pending;
    }

    final s = status.toLowerCase();
    if (s.contains('pass') || s == 'approved') return StatusChipType.pass;
    if (s.contains('fail') || s == 'rejected') return StatusChipType.fail;
    if (s.contains('paid')) return StatusChipType.paid;
    if (s.contains('dispatch')) return StatusChipType.dispatched;
    if (s.contains('sync') || s == 'pending sync') return StatusChipType.sync;
    return StatusChipType.pending;
  }

  String get _labelKey {
    if (displayKey != null && displayKey!.isNotEmpty) return displayKey!;
    switch (_type) {
      case StatusChipType.pass:
        return 'quality_passed';
      case StatusChipType.fail:
        return 'quality_failed';
      case StatusChipType.paid:
        return 'collection_paid';
      case StatusChipType.approved:
        return 'collection_approved';
      case StatusChipType.dispatched:
        return 'collection_dispatched';
      case StatusChipType.rejected:
        return 'collection_rejected';
      case StatusChipType.sync:
        return 'pending_sync';
      case StatusChipType.pending:
        return 'collection_pending';
    }
  }

  String _label() => Translations.labelForKey(_labelKey, locale);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (bg, fg) = _colors(isDark);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 9 : 10,
        vertical: compact ? 5 : 6,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: _type == StatusChipType.sync
            ? Border.all(color: fg.withValues(alpha: 0.4), style: BorderStyle.solid)
            : null,
      ),
      child: Text(
        _label(),
        style: TextStyle(
          color: fg,
          fontSize: compact ? 12 : 13,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  (Color, Color) _colors(bool isDark) {
    switch (_type) {
      case StatusChipType.pass:
      case StatusChipType.approved:
        return (
          (isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5)),
          isDark ? const Color(0xFF6EE7B7) : const Color(0xFF047857),
        );
      case StatusChipType.paid:
        return (
          AppColors.nestleBlue.withValues(alpha: isDark ? 0.22 : 0.12),
          AppColors.nestleBlue,
        );
      case StatusChipType.dispatched:
        return (
          (isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7)),
          isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
        );
      case StatusChipType.fail:
      case StatusChipType.rejected:
        return (
          (isDark ? const Color(0xFF450A0A) : const Color(0xFFFEE2E2)),
          isDark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C),
        );
      case StatusChipType.sync:
        return (
          (isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7)),
          isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
        );
      case StatusChipType.pending:
        return (
          (isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7)),
          isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
        );
    }
  }
}
