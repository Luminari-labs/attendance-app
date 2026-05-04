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
