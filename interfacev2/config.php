<?php
// config.php - Configuration de la base de données et constantes

// Configuration de la base de données
define('DB_HOST', 'localhost');
define('DB_NAME', 'tubeai_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Constantes de l'application
define('SITE_NAME', 'TubeAI');
define('SITE_URL', 'http://localhost/tubeai');

// Clés API (à sécuriser avec des variables d'environnement en production)
define('YOUTUBE_API_KEY', 'votre_cle_youtube_api');
define('OPENAI_API_KEY', 'votre_cle_openai_api');

// Fuseau horaire
date_default_timezone_set('Europe/Paris');

// Démarrer la session
session_start();

// Fonction de connexion à la base de données
function getDB() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        die("Erreur de connexion à la base de données: " . $e->getMessage());
    }
}

// Fonction pour échapper les données HTML
function escape($string) {
    return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
}

// Fonction pour vérifier si l'utilisateur est connecté
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

// Fonction pour rediriger
function redirect($url) {
    header("Location: $url");
    exit;
}
?>