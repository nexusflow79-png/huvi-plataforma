-- Migração para Aditivo Descoberta (Busca por Zonas Geográficas)

-- 1. Criação da Tabela Pública de Zonas (Reference Data, sem tenant_id nem RLS)
CREATE TABLE IF NOT EXISTS public.city_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    city VARCHAR(255) NOT NULL,
    zones TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(state, city)
);

-- 2. Adicionar novos campos em opportunities
ALTER TABLE public.opportunities
    ADD COLUMN IF NOT EXISTS zona_origem TEXT,
    ADD COLUMN IF NOT EXISTS ciclo_id UUID;

-- 3. Adicionar novos campos em outscraper_search_log
ALTER TABLE public.outscraper_search_log
    ADD COLUMN IF NOT EXISTS zonas_executadas TEXT[],
    ADD COLUMN IF NOT EXISTS tempo_total_ms INTEGER,
    ADD COLUMN IF NOT EXISTS ciclo_id UUID;

-- 4. Inserir dados iniciais de Zonas (As 10 cidades prioritárias)
INSERT INTO public.city_zones (state, city, zones) VALUES
    ('SP', 'São Paulo', ARRAY['Centro', 'Pinheiros', 'Vila Mariana', 'Mooca', 'Santana', 'Lapa', 'Santo André', 'Tatuapé', 'Itaim Bibi', 'Morumbi', 'Campo Limpo', 'Penha']),
    ('AL', 'Maceió', ARRAY['Pajuçara', 'Jatiúca', 'Farol', 'Ponta Verde', 'Mangabeiras', 'Centro', 'Benedito Bentes', 'Tabuleiro']),
    ('CE', 'Fortaleza', ARRAY['Aldeota', 'Meireles', 'Fátima', 'Benfica', 'Messejana', 'Maraponga', 'Parangaba', 'Caucaia']),
    ('RJ', 'Rio de Janeiro', ARRAY['Centro', 'Copacabana', 'Ipanema', 'Barra da Tijuca', 'Botafogo', 'Tijuca', 'Méier', 'Madureira', 'Bangu', 'Campo Grande']),
    ('PE', 'Recife', ARRAY['Boa Viagem', 'Pina', 'Derby', 'Espinheiro', 'Graças', 'Casa Forte', 'Madalena', 'Várzea', 'Boa Vista']),
    ('BA', 'Salvador', ARRAY['Pituba', 'Itaigara', 'Caminho das Árvores', 'Rio Vermelho', 'Barra', 'Graça', 'Vitória', 'Brotas']),
    ('MG', 'Belo Horizonte', ARRAY['Savassi', 'Lourdes', 'Funcionários', 'Centro', 'Sion', 'Belvedere', 'Pampulha', 'Buritis', 'Prado', 'Barreiro']),
    ('PR', 'Curitiba', ARRAY['Batel', 'Água Verde', 'Centro', 'Bigorrilho', 'Portão', 'Santa Felicidade', 'Cabral', 'Jardim Botânico']),
    ('AM', 'Manaus', ARRAY['Centro', 'Adrianópolis', 'Vieiralves', 'Parque 10', 'Cidade Nova', 'Ponta Negra', 'São José']),
    ('DF', 'Brasília', ARRAY['Plano Piloto', 'Lago Sul', 'Lago Norte', 'Águas Claras', 'Taguatinga', 'Guará', 'Sudoeste'])
ON CONFLICT (state, city) 
DO UPDATE SET zones = EXCLUDED.zones, updated_at = NOW();

-- Criar trigger para atualizar o updated_at na city_zones
CREATE OR REPLACE FUNCTION update_city_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_city_zones_updated_at ON public.city_zones;
CREATE TRIGGER trg_city_zones_updated_at
BEFORE UPDATE ON public.city_zones
FOR EACH ROW
EXECUTE FUNCTION update_city_zones_updated_at();
