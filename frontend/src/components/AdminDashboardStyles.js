import styled from 'styled-components';

export const Container = styled.div`
  max-width: 1000px;
  margin: 20px auto;
  padding: 20px;
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

export const Title = styled.h2`
  margin: 0;
`;

export const LogoutButton = styled.button`
  padding: 8px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #c82333;
  }
`;

export const Card = styled.div`
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
`;

export const CardTitle = styled.h3`
  margin-top: 0;
`;

export const Button = styled.button`
  padding: 10px 20px;
  background-color: ${props => props.$success ? '#28a745' : 'transparent'};
  color: ${props => props.$success ? 'white' : 'inherit'};
  border: ${props => props.$success ? 'none' : '1px solid #ddd'};
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 10px;

  &:hover {
    background-color: ${props => props.$success ? '#218838' : '#f8f9fa'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const QRContainer = styled.div`
  margin-top: 15px;
`;

export const QRToken = styled.div`
  padding: 10px;
  background-color: #f8f9fa;
  margin-top: 5px;
  word-break: break-all;
  font-size: 12px;
`;

export const QRImage = styled.img`
  margin-top: 10px;
`;

export const Section = styled.div`
  margin: 20px 0;
`;

export const RefreshButton = styled.button`
  margin-bottom: 10px;
  padding: 5px 10px;
  cursor: pointer;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const TableHeader = styled.th`
  padding: 8px;
  border: 1px solid #ddd;
  background-color: #f8f9fa;
`;

export const TableCell = styled.td`
  padding: 8px;
  border: 1px solid #ddd;
`;

export const TableRow = styled.tr`
  background-color: ${props => props.$isRed ? 'rgba(220, 53, 69, 0.12)' : 'transparent'};
  border-left: ${props => props.$isRed ? '4px solid #dc3545' : 'none'};
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${props => props.$isRed ? 'rgba(220, 53, 69, 0.18)' : '#f8f9fa'};
  }
`;

export const TabContainer = styled.div`
  display: flex;
  border-bottom: 2px solid #e9ecef;
  margin-bottom: 20px;
  gap: 8px;
`;

export const TabButton = styled.button`
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#007bff' : 'transparent'};
  color: ${props => props.$active ? '#007bff' : '#495057'};
  font-weight: ${props => props.$active ? 'bold' : 'normal'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 15px;

  &:hover {
    color: #007bff;
    background-color: #f8f9fa;
  }
`;

export const FormGrid = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
  align-items: flex-end;
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

export const Label = styled.label`
  font-weight: 500;
  font-size: 14px;
  color: #495057;
`;

export const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
  }
`;

export const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
  
  &:focus {
    outline: none;
    border-color: #80bdff;
  }
`;

export const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0;
`;

export const ScheduleGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  margin-top: 15px;
`;

export const ScheduleDayRow = styled.div`
  display: grid;
  grid-template-columns: 120px 120px 1fr 1fr;
  gap: 15px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #e9ecef;
  background-color: ${props => props.$isWorkday ? 'transparent' : '#f8f9fa'};
  
  @media(max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;
