import 'dart:convert';

import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';
import '../utils/chilling_center_resolver.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final _storage = const FlutterSecureStorage();
  
  Map<String, dynamic>? _user;
  bool _isLoading = true;

  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _initHive().then((_) => checkAuth());
  }

  Future<void> _initHive() async {
    // Hive is already initialized in main/OfflineService, but we need the box
    await Hive.openBox('auth_cache');
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();
    
    // Load from cache first
    final box = Hive.box('auth_cache');
    final cachedUser = box.get('user');
    if (cachedUser != null) {
      _user = Map<String, dynamic>.from(cachedUser as Map);
    }

    try {
      final res = await _api.get('/auth?action=me');
      _user = Map<String, dynamic>.from(res as Map);
      await _mergeAssignmentFields(
        previous: cachedUser is Map ? Map<String, dynamic>.from(cachedUser) : null,
      );
      await box.put('user', _user);
    } catch (e) {
      // If offline, keep the cached user. 
      // Only clear if we get a definitive 401/Unauthorized (not implemented here, but typically)
      // For now, if we have a token but API fails, we assume connectivity issues
      final token = await _storage.read(key: 'auth_token');
      if (token == null) {
        _user = null;
        await box.delete('user');
      } else if (_user != null) {
        await _mergeAssignmentFields(previous: _user);
        await box.put('user', _user);
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Map<String, dynamic>? _decodeJwtPayload(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final normalized = base64Url.normalize(parts[1]);
      final decoded = utf8.decode(base64Url.decode(normalized));
      return Map<String, dynamic>.from(jsonDecode(decoded) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> _mergeAssignmentFields({Map<String, dynamic>? previous}) async {
    if (_user == null) return;

    for (final key in ['chillingCenterId', 'chillingCenterName', 'farmerId', 'farmerCode']) {
      final current = _user![key];
      if (current != null && current.toString().isNotEmpty) continue;
      final fromPrevious = previous?[key];
      if (fromPrevious != null && fromPrevious.toString().isNotEmpty) {
        _user![key] = fromPrevious;
      }
    }

    final token = await _storage.read(key: 'auth_token');
    if (token == null) return;
    final payload = _decodeJwtPayload(token);
    if (payload == null) return;

    for (final key in ['chillingCenterId', 'farmerId', 'farmerCode']) {
      final fromToken = payload[key];
      if (fromToken != null && fromToken.toString().isNotEmpty) {
        _user![key] = fromToken;
      }
    }

    final centerId = ChillingCenterResolver.centerIdFromUser(_user);
    if (centerId != null &&
        (_user!['chillingCenterName'] == null ||
            _user!['chillingCenterName'].toString().isEmpty)) {
      final lookedUp = ChillingCenterResolver.nameForCenterId(centerId);
      if (lookedUp != null) {
        _user!['chillingCenterName'] = lookedUp;
      }
    }
  }

  Future<void> _clearUserScopedCacheIfNeeded(String? previousUserId, String? nextUserId) async {
    if (previousUserId == null ||
        nextUserId == null ||
        previousUserId == nextUserId) {
      return;
    }
    await OfflineService().clearUserScopedCache();
  }

  void updateLocalUser(Map<String, dynamic> newData) {
    if (_user != null) {
      _user!.addAll(newData);
      Hive.box('auth_cache').put('user', _user);
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    final box = Hive.box('auth_cache');
    
    if (!OfflineService().isOnline) {
      final cachedEmail = box.get('login_email');
      final cachedPass = box.get('login_password');
      
      if (email == cachedEmail && password == cachedPass) {
        final cachedUser = box.get('user');
        if (cachedUser != null) {
          _user = Map<String, dynamic>.from(cachedUser as Map);
          notifyListeners();
          return;
        }
      }
      throw Exception('Offline: Credentials do not match the last signed-in user.');
    }

    try {
      final box = Hive.box('auth_cache');
      final previousUserId = box.get('user')?['id']?.toString();
      final res = await _api.post('/auth?action=login', {'email': email, 'password': password});
      await _storage.write(key: 'auth_token', value: res['token']);
      _user = Map<String, dynamic>.from(res['user'] as Map);
      await _mergeAssignmentFields();
      await _clearUserScopedCacheIfNeeded(
        previousUserId,
        _user?['id']?.toString(),
      );
      
      // Save credentials for future offline login
      await box.put('login_email', email);
      await box.put('login_password', password);
      await box.put('user', _user);
      
      notifyListeners();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> register(Map<String, dynamic> data) async {
    final res = await _api.post('/auth?action=register-farmer', data);
    await _storage.write(key: 'auth_token', value: res['token']);
    _user = Map<String, dynamic>.from(res['user'] as Map);

    final selectedCenterId = data['chillingCenterId']?.toString();
    if (selectedCenterId != null && selectedCenterId.isNotEmpty) {
      _user!['chillingCenterId'] = selectedCenterId;
      final centerName = ChillingCenterResolver.nameForCenterId(selectedCenterId);
      if (centerName != null) {
        _user!['chillingCenterName'] = centerName;
      }
    }

    await _mergeAssignmentFields();
    
    // Also save these for offline login later
    final box = Hive.box('auth_cache');
    await box.put('login_email', data['email']);
    await box.put('login_password', data['password']);
    await box.put('user', _user);
    
    notifyListeners();
  }

  Future<void> logout() async {
    await _storage.delete(key: 'auth_token');
    _user = null;
    await Hive.box('auth_cache').delete('user');
    await OfflineService().clearUserScopedCache();
    notifyListeners();
  }
}
