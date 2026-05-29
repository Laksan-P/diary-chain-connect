import 'package:flutter/material.dart';
import '../widgets/timeline_step.dart';
import '../services/translations.dart';

/// Builds collection progress timeline from existing collection/payment fields only.
class CollectionTimeline extends StatelessWidget {
  final String locale;
  final dynamic collection;
  final dynamic payment;
  final dynamic testData;

  const CollectionTimeline({
    super.key,
    required this.locale,
    required this.collection,
    this.payment,
    this.testData,
  });

  TimelineStepState _qualityState(String? result) {
    if (result == null || result.isEmpty || result.toLowerCase() == 'pending') {
      return TimelineStepState.upcoming;
    }
    if (result.toLowerCase() == 'pass') return TimelineStepState.completed;
    return TimelineStepState.failed;
  }

  TimelineStepState _dispatchState(String? status) {
    if (status == null || status.isEmpty) return TimelineStepState.upcoming;
    final s = status.toLowerCase();
    if (s.contains('approved') || s.contains('dispatched')) {
      return TimelineStepState.completed;
    }
    if (s.contains('reject')) return TimelineStepState.failed;
    return TimelineStepState.active;
  }

  TimelineStepState _paymentState(dynamic pay) {
    if (pay == null) return TimelineStepState.upcoming;
    final s = (pay['status'] ?? '').toString().toLowerCase();
    if (s == 'paid') return TimelineStepState.completed;
    if (s == 'pending') return TimelineStepState.active;
    return TimelineStepState.upcoming;
  }

  @override
  Widget build(BuildContext context) {
    final qty = collection['quantity']?.toString() ?? '';
    final quality = collection['qualityResult']?.toString();
    final dispatch = collection['dispatchStatus']?.toString();
    final fat = testData?['fat'] ?? collection['fat'];
    final snf = testData?['snf'] ?? collection['snf'];

    final steps = <({String title, String? subtitle, TimelineStepState state})>[
      (
        title: Translations.get('timeline_collected', locale),
        subtitle: qty.isNotEmpty ? '$qty L' : null,
        state: TimelineStepState.completed,
      ),
      (
        title: Translations.get('timeline_cc_quality', locale),
        subtitle: fat != null ? 'Fat $fat% · SNF ${snf ?? '--'}%' : null,
        state: _qualityState(quality),
      ),
      (
        title: Translations.get('timeline_dispatched', locale),
        subtitle: dispatch,
        state: _dispatchState(dispatch),
      ),
      (
        title: Translations.get('timeline_payment', locale),
        subtitle: payment != null ? 'Rs. ${payment['amount']}' : null,
        state: _paymentState(payment),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Translations.get('collection_timeline', locale),
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 16),
        ...List.generate(steps.length, (i) {
          final s = steps[i];
          return TimelineStep(
            title: s.title,
            subtitle: s.subtitle,
            state: s.state,
            isLast: i == steps.length - 1,
          );
        }),
      ],
    );
  }
}
