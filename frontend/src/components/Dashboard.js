import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import {
  Container, Header, Title, LogoutButton, Card, CardTitle,
  RadioGroup, RadioLabel, Button, ReaderContainer,
  Message, LoadingText, HistorySection, Table, TableHeader, TableCell
} from './DashboardStyles';

const API_URL = '';

const Dashboard = () => {
  const [scanning, setScanning] = useState(false);
  const [attendanceType, setAttendanceType] = useState('entry');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onScanSuccessRef = useRef(null);
  const onScanErrorRef = useRef(null);
  const attendanceTypeRef = useRef(attendanceType);
  attendanceTypeRef.current = attendanceType;

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let scanner;

    const startScanner = async () => {
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const onSuccess = (text) => onScanSuccessRef.current(text);
      const onError = (err) => onScanErrorRef.current(err);

      try {
        scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;

        const facingModes = ["environment", "user"];
        for (const facingMode of facingModes) {
          if (stopped) return;
          try {
            await scanner.start({ facingMode }, config, onSuccess, onError);
            return;
          } catch (err) {
            if (facingMode === facingModes[facingModes.length - 1]) throw err;
            console.warn(`Camera "${facingMode}" not available, trying next:`, err);
          }
        }
      } catch (err) {
        if (stopped) return;
        console.error('Camera error:', err);
        const msg = String(err);
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setMessage('Permiso de cámara denegado. Asegúrate de usar HTTPS o localhost y conceder permiso.');
        } else if (msg.includes('NotFoundError')) {
          setMessage('No se encontró ninguna cámara en este dispositivo.');
        } else {
          setMessage('Error al iniciar la cámara: ' + (err.message || err));
        }
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      stopped = true;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      }
    };
  }, [scanning]);

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
    setScanning(true);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
      }).catch(() => {});
    }
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
      setMessage(`Success! ${attendanceTypeRef.current} marked at ${new Date().toLocaleTimeString()}`);
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
            <ReaderContainer id="reader" />
            <Button $danger $marginTop onClick={stopScanning}>Cancel Scan</Button>
          </div>
        )}

        {message && <Message $success={message.includes('Success')}>{message}</Message>}
        {loading && <LoadingText>Processing...</LoadingText>}
      </Card>

      <HistorySection>
        <CardTitle>My Attendance History</CardTitle>
        <Table>
          <thead>
            <tr>
              <TableHeader>Type</TableHeader>
              <TableHeader>Timestamp</TableHeader>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.id}>
                <TableCell>{record.type}</TableCell>
                <TableCell>{new Date(record.timestamp).toLocaleString()}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </HistorySection>
    </Container>
  );
};

export default Dashboard;
