// Constantes do Financeiro (categorias de despesa padrão + formas de pagamento).
// Categorias personalizadas do salão são carregadas do banco e mescladas em runtime.

export const CATEGORIAS = [
  { id: 'aluguel', label: 'Aluguel', cor: '#B91C1C', icon: '🏠' },
  { id: 'luz', label: 'Luz', cor: '#D97706', icon: '💡' },
  { id: 'agua', label: 'Água', cor: '#1E40AF', icon: '💧' },
  { id: 'internet', label: 'Internet', cor: '#6D28D9', icon: '📶' },
  { id: 'telefone', label: 'Telefone', cor: '#0E7490', icon: '📱' },
  { id: 'produtos', label: 'Produtos', cor: '#8B2655', icon: '💅' },
  { id: 'materiais', label: 'Materiais', cor: '#A16207', icon: '🧰' },
  { id: 'equipamentos', label: 'Equipamentos', cor: '#15803D', icon: '🔧' },
  { id: 'salario', label: 'Salário', cor: '#7C3AED', icon: '👥' },
  { id: 'imposto', label: 'Imposto', cor: '#991B1B', icon: '📋' },
  { id: 'marketing', label: 'Marketing', cor: '#DB2777', icon: '📣' },
  { id: 'manutencao', label: 'Manutenção', cor: '#0F766E', icon: '🛠' },
  { id: 'transporte', label: 'Transporte', cor: '#1D4ED8', icon: '🚗' },
  { id: 'outros', label: 'Outros', cor: '#525252', icon: '📦' },
]

export const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'boleto', label: 'Boleto' },
]
