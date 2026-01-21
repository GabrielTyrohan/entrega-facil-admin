export const PAGINATION = { 
  // BACKEND (Supabase .range) 
  BACKEND_PAGE_SIZE: 15, // Clientes, Vendedores, Entregas 
  
  // FRONTEND (JavaScript .slice) 
  FRONTEND_PAGE_SIZE: 15, // Funcionários, Pagamentos 
  
  // Helpers 
  calculateRange: (page: number, size: number) => { 
    const from = page * size; 
    const to = from + size - 1; 
    return { from, to }; 
  }, 
  
  calculateSlice: (page: number, size: number) => { 
    const start = page * size; 
    const end = start + size; 
    return { start, end }; 
  }, 
  
  calculateTotalPages: (totalItems: number, size: number) => { 
    return Math.ceil(totalItems / size); 
  }, 
};
