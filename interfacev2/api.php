<?php
// api.php - Exemple d'API backend pour gérer les requêtes

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Connexion à la base de données (à configurer selon vos besoins)
function getDBConnection() {
    $host = 'localhost';
    $dbname = 'tubeai_db';
    $username = 'root';
    $password = '';
    
    try {
        $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch(PDOException $e) {
        return null;
    }
}

// Récupérer les statistiques
function getStats() {
    // Exemple de données statiques (à remplacer par des données réelles de votre BDD)
    return [
        'views' => [
            'value' => '1.2M',
            'change' => '+12.5%',
            'type' => 'positive'
        ],
        'subscribers' => [
            'value' => '45.2K',
            'change' => '+2.3K',
            'type' => 'positive'
        ],
        'engagement' => [
            'value' => '8.5%',
            'change' => '+0.5%',
            'type' => 'positive'
        ],
        'watchTime' => [
            'value' => '2.5K h',
            'change' => '-2.1%',
            'type' => 'negative'
        ]
    ];
}

// Récupérer les suggestions de contenu
function getSuggestions() {
    return [
        [
            'id' => 1,
            'title' => '10 astuces pour booster votre productivité',
            'tags' => ['Tendance', 'Haut'],
            'difficulty' => 'high'
        ],
        [
            'id' => 2,
            'title' => 'Tutoriel complet : Débuter avec...',
            'tags' => ['Populaire', 'Moyen'],
            'difficulty' => 'medium'
        ]
    ];
}

// Traiter les messages de l'assistant IA
function processAIMessage($message) {
    // Ici, vous pouvez intégrer une vraie API IA (OpenAI, etc.)
    return [
        'response' => "J'ai bien reçu votre message : " . $message,
        'timestamp' => date('Y-m-d H:i:s')
    ];
}

// Router pour gérer les différentes requêtes
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['path']) ? $_GET['path'] : '';

switch($path) {
    case 'stats':
        if ($method === 'GET') {
            echo json_encode(['success' => true, 'data' => getStats()]);
        }
        break;
        
    case 'suggestions':
        if ($method === 'GET') {
            echo json_encode(['success' => true, 'data' => getSuggestions()]);
        }
        break;
        
    case 'ai-message':
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $message = $input['message'] ?? '';
            
            if ($message) {
                $response = processAIMessage($message);
                echo json_encode(['success' => true, 'data' => $response]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Message vide']);
            }
        }
        break;
        
    default:
        echo json_encode(['success' => false, 'error' => 'Route non trouvée']);
        break;
}
?>