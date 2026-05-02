import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/offline_service.dart';
import '../services/toast_service.dart';
import 'app_theme.dart';

class RecordCollectionScreen extends StatefulWidget {
  const RecordCollectionScreen({super.key});

  @override
  State<RecordCollectionScreen> createState() => _RecordCollectionScreenState();
}

class _RecordCollectionScreenState extends State<RecordCollectionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _tempController = TextEditingController();
  final _qtyController = TextEditingController();
  String _milkType = 'Cow';
  bool _isLoading = false;

  @override
  void dispose() {
    _tempController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final farmerId = auth.user?['farmerId'];
    final ccId = auth.user?['chillingCenterId'];

    if (farmerId == null || ccId == null) {
      ToastService.show(context, 'Missing account details', isError: true);
      return;
    }

    final now = DateTime.now();
    final data = {
      'farmerId': farmerId,
      'chillingCenterId': ccId,
      'date': '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}',
      'time': '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
      'temperature': double.parse(_tempController.text),
      'quantity': double.parse(_qtyController.text),
      'milkType': _milkType,
    };

    if (!OfflineService().isOnline) {
      await OfflineService().addPendingAction('/collections', 'POST', data);
      if (mounted) {
        ToastService.show(context, 'Saved offline. Will sync when online.');
        Navigator.pop(context);
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      // In a real app, we'd call the API here. 
      // For now, we'll use the OfflineService's sync mechanism or just call API directly.
      // Since ApiService is already used by OfflineService, I'll just use it.
      await OfflineService().addPendingAction('/collections', 'POST', data);
      await OfflineService().syncPendingActions();
      
      if (mounted) {
        ToastService.show(context, 'Collection recorded successfully');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) ToastService.show(context, e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Record Milk Collection', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _field(_tempController, 'Temperature (°C)', LucideIcons.thermometer),
              const SizedBox(height: 16),
              _field(_qtyController, 'Quantity (Liters)', LucideIcons.droplets),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _milkType,
                decoration: AppTheme.inputDecoration('Milk Type', LucideIcons.info, context: context),
                items: ['Cow', 'Buffalo', 'Goat'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (v) => setState(() => _milkType = v!),
              ),
              const SizedBox(height: 40),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleSubmit,
                style: AppTheme.primaryButton(context),
                child: _isLoading 
                  ? const CircularProgressIndicator(color: Colors.white) 
                  : const Text('Record Collection'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon) {
    return TextFormField(
      controller: controller,
      decoration: AppTheme.inputDecoration(label, icon, context: context),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
    );
  }
}
