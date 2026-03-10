# Manual do Sistema - Entrega Fácil Admin

Este documento é um guia detalhado sobre o funcionamento de **todas as telas** do sistema de administração (frontend), explicando o fluxo de negócios, as opções disponíveis e as regras de negócio embutidas.

---

## 1. Dashboard (Painel Principal)
**Onde fica:** Rota `/`
- **O que faz:** É a tela inicial do sistema. Apresenta um resumo dinâmico das principais métricas do negócio em tempo real.
- **Indicadores (KPIs):** Mostra a quantidade de Vendedores Ativos, o número de Entregas do Mês, o Faturamento Mensal (apenas o que já foi recebido) e os Valores em Falta (fiadores/devedores). Inclui um comparativo percentual com o mês anterior.
- **Gráficos:** Exibe um gráfico de barras com o histórico de faturamento dos últimos 12 meses, um gráfico de pizza com os métodos de pagamento mais usados e o Top 5 Vendedores (por entregas realizadas e valor movimentado).
- **Alertas de Estoque:** Um painel lateral que avisa se algum produto está com estoque ZERADO (vermelho) ou ABAIXO DO MÍNIMO (amarelo), permitindo ação rápida do gestor.

## 2. Pessoas

### 2.1. Vendedores
**Onde fica:** `/vendedores`
- **O que faz:** Gerencia os parceiros que fazem a distribuição de produtos/cestas nas ruas.
- **Funcionalidades:** 
  - Listagem completa com busca por nome, email e status.
  - Cadastro de novos vendedores vinculando-os ao administrador atual.
  - Edição de dados e ativação/inativação (um vendedor inativo não pode receber novas entregas).
- **Diferencial:** Vendedores são a "ponte"; as vendas e entregas obrigatoriamente passam por eles (exceto fluxo corporativo de Atacado/PJ).

### 2.2. Funcionários (Apenas Admin)
**Onde fica:** `/funcionarios`
- **O que faz:** Gerencia a equipe interna (operadores de sistema, caixas, estoquistas).
- **Funcionalidades:**
  - O administrador dono do negócio pode criar sub-contas para seus funcionários.
  - **RBAC (Controle de Acesso):** Ao cadastrar, o admin pode ligar/desligar até 9 permissões individuais (ex: "Acesso a Relatórios", "Acesso ao Caixa", "Configurações Fiscais"). O funcionário enxergará **apenas** o que for permitido.
  - O funcionário recebe uma senha gerada automaticamente (8 caracteres seguros) no momento da criação.

### 2.3. Clientes
**Onde fica:** `/clientes`
- **O que faz:** Cadastro final de quem comprou o produto do vendedor nas ruas.
- **Funcionalidades:**
  - Suporta dois tipos: **Pessoa Física (PF)** (com CPF e RG) e **Pessoa Jurídica (PJ)** (com CNPJ, Inscrição Estadual e Razão Social).
  - Um cliente é geralmente vinculado a um vendedor de rota (carteira do vendedor).
  - Busca integrada avançada (normalizada sem acentos).
  - Inclui cadastro de endereços dinâmico via CEP.

---

## 3. Catálogo e Estoque

### 3.1. Produtos
**Onde fica:** `/produtos`
- **O que faz:** O "Dicionário" do supermercado/comércio. Aqui ficam os dados perenes dos produtos.
- **Funcionalidades:**
  - Inserção de informações comerciais: nome, categoria (ex: Laticínios, Limpeza), código interno/código de barras.
  - **Informações Fiscais (Importante):** Permite configurar NCM, CEST, CFOP padrão de saída e situação tributária (CST) do ICMS, PIS e COFINS. Estes dados serão usados automaticamente na emissão de NF-e.
  - Definição de níveis de estoque: "Quantidade Máxima" e "Estoque Crítico" (disparam o alerta do Dashboard).
  - A quantidade real em estoque não é alterada aqui; ela reflete o módulo físico de movimentação.

### 3.2. Cestas
**Onde fica:** `/produtos/cestas` e `/produtos/cestas/nova`
- **O que faz:** Permite criar "Kits" ou "Combos" formados por múltiplos produtos (ex: "Cesta Básica Tamanho M" contendo 2 Arroz, 1 Feijão, 1 Óleo).
- **Funcionalidades:**
  - Você monta a receita da cesta (Cesta Base). O sistema bloqueia a inclusão de produtos cujo valor seja zerado (R$ 0,00) para garantir a integridade comercial da receita.
  - **Validação Inteligente:** Você não consegue enviar para a rua mais cestas do que o seu estoque comporta. O sistema identifica o ingrediente mais escasso (o gargalo) e bloqueia o campo limitando o número físico real na hora de distribuir a cesta base ao vendedor.
  - Contém atalho rápido para deletar (retorna os ingredientes ao estoque) e atalho (botão laranja) para Entregas Avulsas.

### 3.3. Entregas Avulsas
**Onde fica:** `/entregas/avulsas`
- **O que faz:** Permite enviar produtos individuais para o carro/carga de um Vendedor sem a formalidade de montar uma "Cesta" pré-configurada.
- **Funcionalidades:** 
  - Possui busca complexa no catálogo (ignora acentos, busca palavras soltas).
  - Bloqueia automaticamente a adição de itens sem estoque físico ou itens com valor zerado.
  - Debita os itens diretamente do estoque físico no exato momento da confirmação.

### 3.4. Movimentações de Estoque
**Onde fica:** `/estoque/movimentacoes` e `/estoque/relatorio` (Requer Perm.: Caixa/Estoque)
- **O que faz:** Livro-razão do inventário (Ledger). 
- **Regra de Ouro:** O estoque nunca é apagado ou "digitado manualmente por cima". Ele sofre "Movimentações".
- Se você comprou mercadoria, faz uma **Entrada Automática**. Se algo deteriorou, faz **Saída por Perda**. As vendas do sistema e entregas debitam **Saída por Venda** automaticamente sem intervenção humana.
- O Relatório tira uma "foto" mostrando quantas unidades físicas de cada insumo há na prateleira hoje.

---

## 4. Operacional e Financeiro

### 4.1. Entregas (Histórico e Nova Entrega)
**Onde fica:** `/entregas` e `/entregas/nova`
- **O que faz:** Painel das rotas fechadas. Mostra a qual cliente e de qual vendedor tal cesta foi entregue. Nova Entrega cria um vínculo cliente-vendedor baseado num pacote padronizado (Cesta Base).
- **Funcionalidades:**
  - Na tela de Nova Entrega, a seleção de Clientes exibe unicamente Pessoas Físicas (PF) pelo seu nome completo formatado. O pacote é montado utilizando os itens matriciais extraídos direto de uma Cesta Base previamente escolhida.
  - Registra a data da entrega e o preço combinado na visualização geral.
  - Você pode Editar ou Excluir uma entrega errada. Se excluir, o sistema **estorna** os itens para a prateleira imediatamente para evitar furos logísticos.

### 4.2. Pagamentos
**Onde fica:** `/pagamentos`
- **O que faz:** Livro-caixa virtual de recebimentos de entregas.
- **Funcionalidades:**
  - Registra quando o Vendedor prestou conta de uma Cesta/Produto.
  - Status podem ser: "Pago", "Parcial" ou "Pendente" (Fiado).
  - Formas de pagamento suportadas: Dinheiro, Pix, Cartão de Crédito/Débito.

### 4.3. Devedores (Inadimplência)
**Onde fica:** `/devedores`
- **O que faz:** Painel de "nome sujo". Filtra cirurgicamente apenas Clientes ou Vendedores que pegaram mercadoria e o Status do pagamento é "Pendente" ou "Parcial".
- Exibe o somatório total de dinheiro retido nas ruas (Dinheiro a receber).

### 4.4. Fluxo de Caixa e Acertos Diários
**Onde fica:** `/caixa` e `/acertos-diarios` (Requer Permissões específicas)
- **Caixa:** Conta bancária/gaveta física da empresa. Tudo que entra ou sai de dinheiro (pagar conta de luz, recebimento de cliente).
- **Acertos Diários:** Prestação de contas no final do dia do Vendedor. O vendedor chegou de rota, descarregou o canivete de dinheiro, o caixa conta e emite o recibo no Acerto Diário (Sobra/Falta de caixa).

---

## 5. Comercial / Corporativo

### 5.1. Vendas no Atacado e Tabela de Preços
**Onde fica:** `/vendas-atacado` e `/tabela-precos` (Requer Perm.: Vendas Atacado)
- Diferente do fluxo de carrinho de rua (Vendedor), o sistema possui o módulo **Atacado**, voltado a faturamento direto (Ex: Supermercado comprando 500 fardos de você).
- Possui uma tabela de preços paralela: o preço do produto no varejo pode ser X, mas no atacado (via Tabela de Preços) você parametriza Y de acordo com o volume de compra.

### 5.2. Orçamentos PJ (Geração de NF-e)
**Onde fica:** `/orcamentos-pj` (Requer Perm.: Orçamentos PJ)
- **O que faz:** Propostas comerciais formais para CNPJs parceiros.
- **Fluxo:** Você gera um Orçamento com itens e validade. Ele nasce como "Pendente". 
- Se aprovado pelo cliente da ponta, você altera para "Aprovado" e um botão mágico de **"Emitir NF-e"** é habilitado.
- Esse botão compacta a receita, cruza com o certificado A1 da sua empresa e dispara o XML para o Sefaz validando a nota fiscal. A página exibe o DANFE e a Chave de Acesso se autorizada.

### 5.3. Configurações Fiscais
**Onde fica:** `/configuracoes-fiscais` (Requer Perm. Específica)
- **O que faz:** O coração tributário do Software.
- **Funcionalidades:**
  - Faz o upload do seu certificado `.pfx` ou `.p12` (A1).
  - Você digita a senha do certificado, escolhe o Regime Tributário (Simples, Lucro Real, Presumido) e o ambiente (Homologação para testes com o SEFAZ, Produção valendo dinheiro).
  - Isso abastece de forma segura e criptografada (conversão base64) o emissor do governo via Edge Functions do Supabase.

---

## 6. Relatórios Analíticos
**Onde fica:** `/relatorios`
- Maior tela do sistema, une os bancos do Financeiro Mês-a-Mês, Contabilidade de Fluxo de Caixa Diário, e Pagamentos.
- Ao solicitar o período de 1 ano, ignora paginação e processa massivamente até 10.000 transações em milissegundos.
- Pode plotar tudo em arquivos `.XLSX` (Excel) ou documentar via PDF diretamente do navegador.

## 7. Meu Perfil / Sistema / Suporte
**Onde fica:** Menu Lateral Inferior
- Permite alterar a própria senha, sair do sistema e abrir tickets de chat com o suporte via Supabase.
- Na base do menu da esquerda, aponta qual a versão contígua do sistema atuando (atualmente linkada fisicamente ao patch release, v1.0.2 e derivadas, garantindo que o colaborador saiba se está com pendência de reload de cache de service worker).
