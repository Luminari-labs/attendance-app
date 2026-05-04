import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import {
  Container, Header, Title, LogoutButton, Card, CardTitle,
  RadioGroup, RadioLabel, Button, ReaderContainer, LocationText,
  Message, LoadingText, HistorySection, Table, TableHeader, TableCell
} from './DashboardStyles';

const API_URL = '';

const Dashboard = () => {
  const [scanning, setScanning] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [attendanceType, setAttendanceType] = useState('entry');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

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

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationError('');
      },
      (error) => {
        setLocationError('Unable to get location: ' + error.message);
      }
    );
  };

  const startScanning = () => {
    setScanning(true);
    getLocation();
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    scannerRef.current = new Html5Qrcode("reader");
    scannerRef.current.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanError
    ).catch(err => {
      console.error('Scanner start error:', err);
      setMessage('Failed to start scanner: ' + err.message);
    });
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
        setScanning(false);
      }).catch(err => console.error('Scanner stop error:', err));
    }
  };

  const onScanSuccess = async (decodedText) => {
    stopScanning();
    if (!location) {
      setMessage('Location not available. Please enable GPS and try again.');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/api/attendance/mark`,
        {
          qr_token: decodedText,
          latitude: location.latitude,
          longitude: location.longitude,
          type: attendanceType
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`Success! ${attendanceType} marked at ${new Date().toLocaleTimeString()}`);
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

        {location && (
          <LocationText>
            Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </LocationText>
        )}
        {locationError && <Message>{locationError}</Message>}
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
