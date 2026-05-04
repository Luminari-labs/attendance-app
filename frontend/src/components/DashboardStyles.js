import styled from 'styled-components';

export const Container = styled.div`
  max-width: 600px;
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

export const RadioGroup = styled.div`
  margin-bottom: 10px;
`;

export const RadioLabel = styled.label`
  margin-left: ${props => props.margin ? '20px' : '0'};
`;

export const Button = styled.button`
  padding: 10px 20px;
  background-color: ${props => props.$danger ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  width: 100%;
  cursor: pointer;
  margin-top: ${props => props.$marginTop ? '10px' : '0'};

  &:hover {
    background-color: ${props => props.$danger ? '#5a6268' : '#0056b3'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ReaderContainer = styled.div`
  width: 100%;
  margin-top: 10px;
`;

export const LocationText = styled.div`
  margin-top: 10px;
  font-size: 12px;
  color: #666;
`;

export const Message = styled.div`
  margin-top: 10px;
  color: ${props => props.$success ? 'green' : 'red'};
`;

export const LoadingText = styled.div`
  margin-top: 10px;
`;

export const HistorySection = styled.div`
  margin-top: 30px;
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
