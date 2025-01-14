-- Table: concepts_with_counts  ----------------------------------------------------------------------------------------
DROP TABLE IF EXISTS {{schema}}concepts_with_counts{{optional_suffix}} CASCADE;

CREATE TABLE IF NOT EXISTS {{schema}}concepts_with_counts{{optional_suffix}} AS (
    SELECT  concept_id,
            concept_name,
            domain_id,
            vocabulary_id,
            concept_class_id,
            standard_concept,
            concept_code,
            invalid_reason,
            COUNT(DISTINCT domain) AS domain_cnt,
            array_to_string(array_agg(domain), ',') AS domain,
            SUM(total_cnt)::bigint AS total_cnt,
            array_to_string(array_agg(distinct_person_cnt), ',') AS distinct_person_cnt
    FROM {{schema}}concepts_with_counts_ungrouped
    GROUP BY 1,2,3,4,5,6,7,8
    ORDER BY concept_id, domain );

CREATE INDEX cc_idx1{{optional_index_suffix}} ON {{schema}}concepts_with_counts{{optional_suffix}}(concept_id);

-- Index cwcgin takes some time to complete
CREATE INDEX cwcgin{{optional_index_suffix}} ON {{schema}}concepts_with_counts{{optional_suffix}} USING gin (concept_name gin_trgm_ops);
--  this query will go fast with the index above and slow otherwise
--       SELECT *
--       FROM concepts_with_counts
--       WHERE concept_name ILIKE '%test%'
