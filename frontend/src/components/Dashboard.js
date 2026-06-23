import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import axios from 'axios';
import {
  Container, Header, Title, LogoutButton, Card, CardTitle,
  RadioGroup, RadioLabel, Button, ReaderContainer,
  Message, LoadingText, HistorySection, Table, TableHeader, TableCell, FinesSection
} from './DashboardStyles';

const API_URL = '';
const READER_ELEMENT_ID = 'reader';
const EC_TIMEZONE = 'America/Guayaquil';
const formatEC = (date) => new Date(date).toLocaleString('es-EC', { timeZone: EC_TIMEZONE });
const formatTimeEC = (date) => new Date(date).toLocaleTimeString('es-EC', { timeZone: EC_TIMEZONE });

const getCameraErrorMessage = (err) => {
  const msg = String(err?.message || err || '');

  if (!window.isSecureContext) {
    return 'La cámara solo funciona en HTTPS o localhost. Abre la app con HTTPS para escanear el QR.';
  }

  if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('denied')) {
    return 'Permiso de cámara denegado. Concede permiso al navegador e intenta de nuevo.';
  }

  if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
    return 'No se encontró ninguna cámara en este dispositivo.';
  }

  if (msg.includes('NotReadable') || msg.includes('TrackStart')) {
    return 'La cámara está ocupada por otra aplicación. Ciérrala e intenta de nuevo.';
  }

  if (msg.includes('Overconstrained')) {
    return 'No se pudo usar la cámara solicitada. Intenta de nuevo o revisa los permisos del navegador.';
  }

  return 'Error al iniciar la cámara: ' + msg;
};

const FINE_TYPE_LABELS = {
  missing_entry: 'Falta Entrada',
  missing_exit: 'Falta Salida',
  late_entry: 'Entrada Tarde',
  early_exit: 'Salida Temprana'
};

const Dashboard = () => {
  const [scanning, setScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [attendanceType, setAttendanceType] = useState('entry');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onScanSuccessRef = useRef(null);
  const onScanErrorRef = useRef(null);
  const attendanceTypeRef = useRef(attendanceType);
  attendanceTypeRef.current = attendanceType;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      const state = scanner.getState();
      const isRunning = state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED;

      if (isRunning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (err) {
      console.warn('QR scanner cleanup failed:', err);
      try {
        scanner.clear();
      } catch (_) {}
    } finally {
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadFines();
  }, []);

  const loadFines = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/attendance/my-fines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFines(res.data);
    } catch (err) {
      console.error('Failed to load fines', err);
    }
  };

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;

    const startScanner = async () => {
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const onSuccess = (text) => onScanSuccessRef.current(text);
      const onError = (err) => onScanErrorRef.current(err);

      try {
        setMessage('');
        setScannerStatus('Solicitando permiso de cámara...');

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available in this browser');
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
        const readerElement = document.getElementById(READER_ELEMENT_ID);
        if (!readerElement) {
          throw new Error('QR reader container was not mounted');
        }

        const cameras = await Html5Qrcode.getCameras();
        if (stopped) return;
        if (!cameras.length) {
          throw new Error('NotFoundError');
        }

        const preferredCamera =
          cameras.find((camera) => /back|rear|environment|trasera/i.test(camera.label)) || cameras[0];

        const scanner = new Html5Qrcode(READER_ELEMENT_ID);
        scannerRef.current = scanner;

        setScannerStatus('Abriendo cámara...');
        await scanner.start(preferredCamera.id, config, onSuccess, onError);
        if (stopped) {
          await stopScanner();
          return;
        }

        setScannerStatus('Apunta la cámara al código QR.');
      } catch (err) {
        if (stopped) return;
        console.error('Camera error:', err);
        setMessage(getCameraErrorMessage(err));
        setScannerStatus('');
        await stopScanner();
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      stopped = true;
      void stopScanner();
    };
  }, [scanning, stopScanner]);

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/attendance/my-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const startScanning = () => {
    setMessage('');
    setScannerStatus('');
    setScanning(true);
  };

  const stopScanning = async () => {
    await stopScanner();
    setScannerStatus('');
    setScanning(false);
  };

  const onScanSuccess = async (decodedText) => {
    stopScanning();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/api/attendance/mark`,
        { qr_token: decodedText, type: attendanceTypeRef.current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`Success! ${attendanceTypeRef.current} marked at ${formatTimeEC(res.data.timestamp)} (Ecuador/Guayaquil)`);
      loadHistory();
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const onScanError = (error) => {
    console.debug('QR scan error:', error);
  };

  onScanSuccessRef.current = onScanSuccess;
  onScanErrorRef.current = onScanError;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container>
      <Header>
        <Title>Welcome, {user?.email}</Title>
        <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
      </Header>

      <Card>
        <CardTitle>Mark Attendance</CardTitle>
        <RadioGroup>
          <label>
            <input type="radio" value="entry" checked={attendanceType === 'entry'} onChange={(e) => setAttendanceType(e.target.value)} />
            Entry
          </label>
          <RadioLabel margin>
            <input type="radio" value="exit" checked={attendanceType === 'exit'} onChange={(e) => setAttendanceType(e.target.value)} />
            Exit
          </RadioLabel>
        </RadioGroup>

        {!scanning ? (
          <Button onClick={startScanning}>Scan QR Code</Button>
        ) : (
          <div>
            {scannerStatus && <LoadingText>{scannerStatus}</LoadingText>}
            <ReaderContainer id={READER_ELEMENT_ID} />
            <Button $danger $marginTop onClick={stopScanning}>Cancel Scan</Button>
          </div>
        )}

        {message && <Message $success={message.includes('Success')}>{message}</Message>}
        {loading && <LoadingText>Processing...</LoadingText>}
      </Card>

      <HistorySection>
        <CardTitle>Historial de Asistencias (Ecuador/Guayaquil)</CardTitle>
        <Table>
          <thead>
            <tr>
              <TableHeader>Tipo</TableHeader>
              <TableHeader>Fecha y Hora</TableHeader>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.id}>
                <TableCell style={{ fontWeight: '600' }}>
                  {record.type === 'entry' ? 'Entrada' : 'Salida'}
                </TableCell>
                <TableCell>{formatEC(record.timestamp)}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </HistorySection>

      <FinesSection>
        <CardTitle>Mis Multas</CardTitle>
        {fines.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#666' }}>No registras multas de asistencia.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <TableHeader>Fecha</TableHeader>
                <TableHeader>Infracción</TableHeader>
                <TableHeader>Detalles</TableHeader>
              </tr>
            </thead>
            <tbody>
              {fines.map((fine) => (
                <tr key={fine.id}>
                  <TableCell>{fine.date}</TableCell>
                  <TableCell style={{ color: '#dc3545', fontWeight: '600' }}>
                    {FINE_TYPE_LABELS[fine.type] || fine.type}
                  </TableCell>
                  <TableCell>{fine.details}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </FinesSection>
    </Container>
  );
};

export default Dashboard;
