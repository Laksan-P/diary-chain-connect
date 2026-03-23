import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final _storage = const FlutterSecureStorage();
  
  Map<String, dynamic>? _user;
  bool _isLoading = true;

  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    checkAuth();
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/auth/me');
      _user = res;
    } catch (e) {
      _user = null;
      // If auth check fails (user removed from DB, etc.), clear the stale token
      await _storage.delete(key: 'auth_token');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    final res = await _api.post('/auth/login', {'email': email, 'password': password});
    await _storage.write(key: 'auth_token', value: res['token']);
    _user = res['user'];
    notifyListeners();
  }

  Future<void> register(Map<String, dynamic> data) async {
    final res = await _api.post('/auth/register-farmer', data);
    await _storage.write(key: 'auth_token', value: res['token']);
    _user = res['user'];
    notifyListeners();
  }

  Future<void> logout() async {
    await _storage.delete(key: 'auth_token');
    _user = null;
    notifyListeners();
  }
}
