# ProTakeOff — Entity Relationship Diagram

> Rendered automatically by GitHub and many markdown editors (Mermaid support required).
> Paste this into [mermaid.live](https://mermaid.live) to see it rendered.

---

## Full ER Diagram

```mermaid
erDiagram
    COMPANY {
        string id PK
        string name
        string logo
        string website
        string plan
        string address
        string phone
        datetime createdAt
        datetime updatedAt
    }

    USER {
        string id PK
        string email UK
        string name
        string password
        string role
        string avatar
        string companyId FK
        datetime createdAt
        datetime updatedAt
    }

    PROJECT {
        string id PK
        string name
        string description
        string status
        string address
        string clientName
        string thumbnail
        string companyId FK
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }

    PROJECT_MEMBER {
        string id PK
        string projectId FK
        string userId FK
        string role
        datetime createdAt
    }

    DOCUMENT {
        string id PK
        string name
        string fileUrl
        string fileType
        int fileSize
        int pageCount
        string thumbnail
        float scale
        string unit
        string projectId FK
        datetime createdAt
        datetime updatedAt
    }

    LAYER {
        string id PK
        string name
        string color
        string type
        boolean visible
        int order
        string documentId FK
        datetime createdAt
        datetime updatedAt
    }

    SHAPE {
        string id PK
        string type
        string data
        string label
        string color
        string layerId FK
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }

    COMPANY ||--o{ USER : "has many"
    COMPANY ||--o{ PROJECT : "owns"
    USER ||--o{ PROJECT : "created by"
    PROJECT ||--o{ PROJECT_MEMBER : "has members"
    USER ||--o{ PROJECT_MEMBER : "member of"
    PROJECT ||--o{ DOCUMENT : "has plans"
    DOCUMENT ||--o{ LAYER : "has layers"
    LAYER ||--o{ SHAPE : "has shapes"
    USER ||--o{ SHAPE : "drew by"
```

---

## Simplified Ownership Flow

```mermaid
flowchart TD
    A[Company] --> B[Users]
    A --> C[Projects]
    C --> D[ProjectMembers]
    B --> D
    C --> E[Documents / PDF Plans]
    E --> F[Layers]
    F --> G[Shapes]
    B --> G
```

---

## Access Control Flow

```mermaid
flowchart LR
    U[User] -->|has platform role| R1["SUPER_ADMIN / ADMIN / MEMBER"]
    U -->|has project role via ProjectMember| R2["ADMIN / EDIT / VIEW"]
    R2 -->|ADMIN| P1["Full project control\n+ invite members"]
    R2 -->|EDIT| P2["Draw + edit shapes\n+ upload plans"]
    R2 -->|VIEW| P3["Read-only canvas\n+ download"]
```

---

## Shape Data Formats

```mermaid
classDiagram
    class Shape {
        +String id
        +String type
        +String data (JSON)
        +String label
        +String color
        +String layerId
    }

    class RectData {
        +Float x
        +Float y
        +Float width
        +Float height
        +Float rotation
        +Float cornerRadius
    }

    class PolygonData {
        +Float[] points
    }

    class LineData {
        +Float[] points
    }

    class CircleData {
        +Float x
        +Float y
        +Float radius
    }

    class TextData {
        +Float x
        +Float y
        +String text
        +Int fontSize
        +Boolean bold
        +Boolean italic
        +Boolean underline
        +Boolean strikethrough
        +String fill
        +Float width
    }

    Shape --> RectData : type=RECT
    Shape --> PolygonData : type=POLYGON
    Shape --> LineData : type=LINE
    Shape --> CircleData : type=CIRCLE
    Shape --> TextData : type=TEXT
```
