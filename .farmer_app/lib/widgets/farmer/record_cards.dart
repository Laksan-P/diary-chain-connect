import 'package:intl/intl.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../services/translations.dart';
import '../../theme/design_tokens.dart';
import '../../utils/collection_status_helper.dart';
import '../status_chip.dart';
import '../glass_card.dart';

class CollectionRecordCard extends StatelessWidget {
  final String locale;
  final dynamic record;
  final VoidCallback? onTap;

  const CollectionRecordCard({
    super.key,
    required this.locale,
    required this.record,
    this.onTap,
  });

  String _formatDate() {
    try {
      final date = record['date']?.toString() ?? '';
      final time = record['time']?.toString() ?? '00:00:00';
      if (date.isEmpty) return '';
      final dt = DateTime.parse('$date $time').toLocal();
      return DateFormat('MMM dd, yyyy • hh:mm a').format(dt);
    } catch (_) {
      return record['date']?.toString() ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final qualityKey = CollectionStatusHelper.qualityDisplayKey(record);
    final qty = double.tryParse(record['quantity']?.toString() ?? '') ?? 0;
    final fat = record['fatPercentage'] ?? record['fat'];
    final snf = record['snfPercentage'] ?? record['snf'];
    final milkTypeKey = record['milkType']?.toString().toLowerCase() ?? 'cow';
    final milkType = Translations.get(milkTypeKey, locale);
    final id = record['id']?.toString() ?? record['collectionId']?.toString() ?? '—';
    final dateStr = _formatDate();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: const EdgeInsets.all(18),
        borderRadius: AppRadii.lg,
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.nestleBlue.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(LucideIcons.droplets, size: 18, color: AppColors.nestleBlue),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '#$id',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: isDark ? Colors.white : AppColors.deepForest,
                        ),
                      ),
                      if (dateStr.isNotEmpty)
                        Text(
                          dateStr,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.white54 : Colors.black54,
                          ),
                        ),
                    ],
                  ),
                ),
                StatusChip(
                  status: qualityKey,
                  displayKey: qualityKey,
                  locale: locale,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _metric(
                  context,
                  Translations.get('quantity', locale),
                  '${qty.toStringAsFixed(qty == qty.toInt() ? 0 : 1)} L',
                ),
                if (milkType.isNotEmpty)
                  _metric(context, Translations.get('milk_type', locale), milkType),
                if (fat != null)
                  _metric(context, Translations.get('fat_percent', locale), '$fat%'),
                if (snf != null)
                  _metric(context, Translations.get('snf_percent', locale), '$snf%'),
              ],
            ),
            if (CollectionStatusHelper.isQualityFail(record)) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
                ),
                child: Text(
                  CollectionStatusHelper.translatedFailureReason(record, locale),
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: isDark ? Colors.white70 : AppColors.error,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metric(BuildContext context, String label, String value) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 10, color: isDark ? Colors.white38 : Colors.black45)),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : AppColors.deepForest,
            ),
          ),
        ],
      ),
    );
  }
}

class PaymentRecordCard extends StatelessWidget {
  final String locale;
  final dynamic record;
  final VoidCallback? onTap;

  const PaymentRecordCard({
    super.key,
    required this.locale,
    required this.record,
    this.onTap,
  });

  String _formatDate() {
    try {
      final raw = record['paidAt'] ?? record['createdAt'];
      if (raw == null) return '';
      return DateFormat('MMM dd, yyyy').format(DateTime.parse(raw.toString()).toLocal());
    } catch (_) {
      return record['paymentDate']?.toString() ?? record['date']?.toString() ?? '';
    }
  }

  String? _cyclePeriod() {
    final start = record['cycleStart'] ?? record['cycle_start'];
    final end = record['cycleEnd'] ?? record['cycle_end'];
    if (start == null || end == null) return null;
    try {
      final s = DateFormat('MMM dd').format(DateTime.parse(start.toString()));
      final e = DateFormat('MMM dd, yyyy').format(DateTime.parse(end.toString()));
      return '$s – $e';
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final amount = double.tryParse(record['amount']?.toString() ?? '') ?? 0;
    final status = (record['status'] ?? '').toString();
    final dateStr = _formatDate();
    final cycle = _cyclePeriod();
    final paymentId = record['id']?.toString() ?? record['collectionId']?.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: const EdgeInsets.all(18),
        borderRadius: AppRadii.lg,
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(LucideIcons.wallet, size: 20, color: AppColors.primaryGreen),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Translations.get('settlement_amount', locale),
                    style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.black54),
                  ),
                  Text(
                    'Rs. ${amount.toStringAsFixed(2)}',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.white : AppColors.deepForest,
                    ),
                  ),
                  if (dateStr.isNotEmpty)
                    Text(
                      dateStr,
                      style: TextStyle(fontSize: 12, color: isDark ? Colors.white38 : Colors.black45),
                    ),
                  if (cycle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      cycle,
                      style: TextStyle(fontSize: 11, color: isDark ? Colors.white38 : Colors.black45),
                    ),
                  ],
                  if (paymentId != null && paymentId.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${Translations.get('payment_id', locale)} #$paymentId',
                      style: TextStyle(fontSize: 11, color: isDark ? Colors.white38 : Colors.black45),
                    ),
                  ],
                ],
              ),
            ),
            if (status.isNotEmpty) StatusChip(status: status, locale: locale),
          ],
        ),
      ),
    );
  }
}
