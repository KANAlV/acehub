-- ACEHUB Subjects ID Migration Script
-- This script alters the subjects table to use 'id' as primary key
-- and updates all related stored functions.

-- 1. ALTER TABLE subjects
-- Add a new UUID primary key column
ALTER TABLE subjects ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Drop existing primary key constraint
ALTER TABLE subjects DROP CONSTRAINT subjects_pkey;

-- Set the new 'id' column as the primary key
ALTER TABLE subjects ADD PRIMARY KEY (id);

-- Allow curriculumn_version to be NULL
ALTER TABLE subjects ALTER COLUMN curriculumn_version DROP NOT NULL;

-- 2. UPDATE STORED FUNCTIONS

-- --- Subjects ---

-- create_subject
CREATE OR REPLACE FUNCTION create_subject(
    p_curriculumn_version TEXT,
    p_course_code TEXT,
    p_course_name TEXT,
    p_field_of_specialization TEXT,
    p_lecture_units INT,
    p_lab_units INT,
    p_lab_type TEXT,
    p_year_term TEXT
)
RETURNS UUID AS $$
DECLARE
    new_subject_id UUID;
BEGIN
    INSERT INTO subjects (curriculumn_version, course_code, course_name, field_of_specialization, lecture_units, lab_units, lab_type, year_term)
    VALUES (p_curriculumn_version, p_course_code, p_course_name, p_field_of_specialization, p_lecture_units, p_lab_units, p_lab_type, p_year_term)
    RETURNING id INTO new_subject_id;
    RETURN new_subject_id;
END;
$$ LANGUAGE plpgsql;

-- update_subject
CREATE OR REPLACE FUNCTION update_subject(
    p_id UUID,
    p_curriculumn_version TEXT,
    p_course_code TEXT,
    p_course_name TEXT,
    p_field_of_specialization TEXT,
    p_lecture_units INT,
    p_lab_units INT,
    p_lab_type TEXT,
    p_year_term TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE subjects
    SET
        curriculumn_version = p_curriculumn_version,
        course_code = p_course_code,
        course_name = p_course_name,
        field_of_specialization = p_field_of_specialization,
        lecture_units = p_lecture_units,
        lab_units = p_lab_units,
        lab_type = p_lab_type,
        year_term = p_year_term
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- delete_subject
CREATE OR REPLACE FUNCTION delete_subject(p_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM subjects WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- fetch_subjects (paginated)
CREATE OR REPLACE FUNCTION fetch_subjects(p_search TEXT, p_limit INT, p_offset INT)
RETURNS TABLE(
    id UUID,
    curriculumn_version TEXT,
    course_code TEXT,
    course_name TEXT,
    field_of_specialization TEXT,
    lecture_units INT,
    lab_units INT,
    lab_type TEXT,
    year_term TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.curriculumn_version, s.course_code, s.course_name, s.field_of_specialization, s.lecture_units, s.lab_units, s.lab_type, s.year_term
    FROM subjects s
    WHERE (p_search = '' OR s.course_code ILIKE '%' || p_search || '%' OR s.course_name ILIKE '%' || p_search || '%')
    ORDER BY s.curriculumn_version DESC NULLS LAST, s.course_code ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- fetch_subject_count
CREATE OR REPLACE FUNCTION fetch_subject_count(p_search TEXT)
RETURNS TABLE(count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT COUNT(*) FROM subjects
    WHERE (p_search = '' OR course_code ILIKE '%' || p_search || '%' OR course_name ILIKE '%' || p_search || '%');
END;
$$ LANGUAGE plpgsql;

-- get_all_subjects (non-paginated)
CREATE OR REPLACE FUNCTION get_all_subjects()
RETURNS TABLE(
    id UUID,
    curriculumn_version TEXT,
    course_code TEXT,
    course_name TEXT,
    field_of_specialization TEXT,
    lecture_units INT,
    lab_units INT,
    lab_type TEXT,
    year_term TEXT
) AS $$
BEGIN
    RETURN QUERY SELECT s.id, s.curriculumn_version, s.course_code, s.course_name, s.field_of_specialization, s.lecture_units, s.lab_units, s.lab_type, s.year_term FROM subjects s ORDER BY s.course_name ASC;
END;
$$ LANGUAGE plpgsql;

-- get_distinct_curriculum_versions
CREATE OR REPLACE FUNCTION get_distinct_curriculum_versions()
RETURNS TABLE(version TEXT) AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT s.curriculumn_version FROM subjects s WHERE s.curriculumn_version IS NOT NULL ORDER BY s.curriculumn_version ASC;
END;
$$ LANGUAGE plpgsql;
