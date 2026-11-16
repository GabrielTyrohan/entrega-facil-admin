import { describe, it, expect } from 'vitest';
import { lerXmlNfeCompra } from '../../utils/lerXmlNfeCompra';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35261112345678000199550010000123451000012345" versao="4.00">
      <ide><serie>1</serie><nNF>12345</nNF><dhEmi>2026-11-10T09:30:00-03:00</dhEmi></ide>
      <emit><CNPJ>12.345.678/0001-99</CNPJ><xNome>SUPERMERCADO BOM PRECO LTDA</xNome></emit>
      <dest><CNPJ>98765432000100</CNPJ></dest>
      <det nItem="1">
        <prod>
          <cProd>ARZ5</cProd><cEAN>7896006716112</cEAN><xProd>ARROZ CAMIL T1 5KG</xProd>
          <NCM>10063021</NCM><uCom>FD</uCom><qCom>2.0000</qCom><vUnCom>110.00</vUnCom>
          <vProd>220.00</vProd><vDesc>10.00</vDesc>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>OLEO9</cProd><cEAN>SEM GTIN</cEAN><cEANTrib>7891107101621</cEANTrib><xProd>OLEO SOJA 900ML</xProd>
          <NCM>15079011</NCM><uCom>un</uCom><qCom>12</qCom><vUnCom>7.20</vUnCom><vProd>86.40</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>296.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>35261112345678000199550010000123451000012345</chNFe></infProt></protNFe>
</nfeProc>`;

describe('lerXmlNfeCompra', () => {
  it('lê fornecedor, nota e totais', () => {
    const n = lerXmlNfeCompra(XML);
    expect(n.fornecedor_nome).toBe('SUPERMERCADO BOM PRECO LTDA');
    expect(n.fornecedor_cnpj).toBe('12345678000199');
    expect(n.destinatario_documento).toBe('98765432000100');
    expect(n.numero_nota).toBe('12345');
    expect(n.serie).toBe('1');
    expect(n.data_emissao).toBe('2026-11-10');
    expect(n.chave_acesso).toBe('35261112345678000199550010000123451000012345');
    expect(n.valor_total).toBe(296.4);
  });

  it('lê itens com desconto, EAN e unidade', () => {
    const [arroz, oleo] = lerXmlNfeCompra(XML).itens;
    expect(arroz).toMatchObject({
      codigo_fornecedor: 'ARZ5', ean: '7896006716112', unidade: 'FD',
      quantidade: 2, valor_total: 210, ncm: '10063021',
    });
    // "SEM GTIN" no cEAN: usa o cEANTrib
    expect(oleo).toMatchObject({ ean: '7891107101621', unidade: 'UN', quantidade: 12, valor_total: 86.4 });
  });

  it('recusa arquivo que não é NF-e', () => {
    expect(() => lerXmlNfeCompra('<a>oi</a>')).toThrow('não parece ser o XML de uma NF-e');
    expect(() => lerXmlNfeCompra('não é xml')).toThrow();
  });
});
